import { expect, test } from 'claude-code/testing'

import {
  anadirNota,
  anchoEnTerminal,
  carreraDe,
  comandoDe,
  envolver,
  lineaDeTicket,
  parseHistory,
  parseMesa,
  parseNotas,
  parsePulso,
  quitarNota,
  recortar,
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

test('el ancho en terminal cuenta dos por emoji y uno por lo demás', () => {
  expect(anchoEnTerminal('▶ LAN-1')).toEqual(7)
  expect(anchoEnTerminal('🐞')).toEqual(2)
  expect(anchoEnTerminal('✅')).toEqual(2)
  expect(anchoEnTerminal('🚧 📖 x')).toEqual(7)
  expect(anchoEnTerminal('José')).toEqual(4)
})

test('recortar no pasa del ancho, y no toca lo que cabe', () => {
  expect(recortar('hola', 4)).toEqual('hola')
  expect(recortar('hola mundo', 6)).toEqual('hola …')
  // El emoji no se parte por la mitad: si no entra, se queda fuera.
  expect(recortar('ab🐞cd', 4)).toEqual('ab…')
  expect(anchoEnTerminal(recortar('🐞🐞🐞🐞', 5))).toBeLessThanOrEqual(5)
})

/**
 * El fallo de la 1.6.0: el ` → dueño` se pegaba después de recortar el resumen
 * al ancho, así que toda línea con dueño se pasaba y envolvía.
 */
test('la línea de un ticket con dueño largo nunca pasa del ancho', () => {
  const base = {
    mark: '🚧',
    tipo: '📖',
    key: 'LAN-12345',
    priority: 'ALTA',
    summary: 'Mandar positionAgeMs en el probe-ack y medir la latencia del sondeo en el conductor',
    otherThreads: '',
    owner: 'María Fernanda de los Ángeles Pérez-Villalobos',
  }
  for (const width of [30, 44, 60, 80, 120]) {
    for (const t of [base, { ...base, tipo: undefined }, { ...base, owner: undefined }, { ...base, mark: '▶' }]) {
      const linea = lineaDeTicket(t, width)
      expect(anchoEnTerminal(linea)).toBeLessThanOrEqual(width)
    }
  }
  // Con sitio, el dueño se ve —recortado por la cola— y el resumen también.
  const ancha = lineaDeTicket(base, 80)
  expect(ancha).toContain(' → María')
  expect(ancha).toContain('Mandar positionAgeMs')
})

test('sin dueño ni emoji la línea sale como siempre', () => {
  const t = { mark: '▶', key: 'LAN-2669', priority: 'ALTA', summary: 'corto', otherThreads: '' }
  expect(lineaDeTicket(t, 80)).toEqual('▶ LAN-2669 ALTA corto')
})

/** Un dorsal escrito como en el fichero: `16` o `16/75`. */
function dorsal(s: number | string): { cerrados: number; abiertos?: number } {
  const [c = 0, a] = String(s).split('/').map(Number)
  return a === undefined ? { cerrados: c } : { cerrados: c, abiertos: a }
}

/** Las tres filas de la carrera como texto plano, para compararlas de un vistazo. */
function plana(cifras: readonly (number | string)[], yo: number | string, width = 65): string[] {
  const c = carreraDe(cifras.map(dorsal), dorsal(yo), width)
  if (!c) return []
  const t = (f: { text: string }[]) => f.map(x => x.text).join('')
  return [t(c.cifras), t(c.flechas), c.pista]
}

test('parsePulso lee la carrera, sin nombres', () => {
  expect(parsePulso('## Pulso\nabren: 4\ncierran: 9\ntuyos: 2\ncarrera: 5 2 1\n')?.carrera).toEqual([
    { cerrados: 5 },
    { cerrados: 2 },
    { cerrados: 1 },
  ])
  expect(parsePulso('## Pulso\nabren: 4\ncierran: 9\ncarrera: Ana 5\n')?.carrera).toBeUndefined()
})

test('parsePulso lee los dorsales con sus abiertos, y tus pendientes', () => {
  const p = parsePulso('## Pulso\nabren: 4\ncierran: 9\ntuyos: 16\npendientes: 75\ncarrera: 16/75 9/1\n')
  expect(p?.carrera).toEqual([
    { cerrados: 16, abiertos: 75 },
    { cerrados: 9, abiertos: 1 },
  ])
  expect(p?.pendientes).toBe(75)
})

test('parsePulso lee la carrera de una sola persona, que también parece una cifra', () => {
  // `carrera: 16` casa con la regla de las cifras; leída ahí, la carrera se perdía.
  const p = parsePulso('## Pulso\nabren: 16\ncierran: 16\ntuyos: 16\npersonas: 1\ncarrera: 16\n')
  expect(p?.carrera).toEqual([{ cerrados: 16 }])
  expect(p).not.toHaveProperty('carrera', 16)
})

test('carreraDe con abiertos: solo, con la mesa llena, no llegas a la meta', () => {
  // 16 cerrados y 75 abiertos: un 18 % del camino, cerca del semáforo.
  const [cifras, flechas, pista] = plana(['16/75'], '16/75')
  expect(cifras?.trimStart()).toBe('16 (Tú)')
  expect(cifras?.indexOf('16')).toBeGreaterThan(40)
  expect(flechas?.indexOf('▼')).toBe(cifras?.indexOf('16'))
  // Solo y sin vaciar la mesa no hay liebre: no vas en cabeza de nadie.
  expect(pista).not.toContain('🐇')
  expect(pista?.startsWith('🏁─')).toBe(true)
})

test('carreraDe con abiertos: solo llega a la meta quien vacía su mesa', () => {
  const [, , pista] = plana(['5/0'], '5/0')
  expect(pista?.startsWith('🏁🐇')).toBe(true)
})

test('carreraDe con abiertos: el orden es de avance, no de cierres', () => {
  // 9/1 va al 90 %, tú 16/75 al 18 %, y 4/36 al 10 %: más cierres no es ir delante.
  const [cifras, , pista] = plana(['9/1', '16/75', '4/36'], '16/75')
  const i9 = cifras?.indexOf('9') ?? -1
  const iTu = cifras?.indexOf('16 (Tú)') ?? -1
  const i4 = cifras?.lastIndexOf('4') ?? -1
  expect(i9).toBeLessThan(iTu)
  expect(iTu).toBeLessThan(i4)
  // La liebre es del más avanzado, aunque cerrara menos que tú.
  expect(pista?.indexOf('🐇')).toBeLessThan(pista?.indexOf('🐢') ?? 0)
})

test('carreraDe con abiertos: quien cerró lo mismo que tú con otra mesa no eres tú', () => {
  const [cifras] = plana(['16/75', '16/4'], '16/75')
  expect(cifras).toContain('16 (Tú)')
  expect(cifras?.replace('16 (Tú)', '')).toContain('16')
})

test('carreraDe con abiertos: los que no cerraron nada son una tortuga, no se pierde ninguno', () => {
  // `0/1` y `0/50` están los dos al 0 %: antes el segundo desaparecía.
  const [cifras, flechas, pista] = plana(['15/33', '0/1', '0/50'], '15/33')
  expect(cifras).toContain('0×2')
  expect(flechas?.split('▼').length).toBe(3)
  expect(pista?.match(/🐢/gu)?.length).toBe(1)
  expect(pista?.endsWith('🐢🚦')).toBe(true)
})

test('carreraDe: sin los abiertos de todos, la meta vuelve a ser el líder', () => {
  // Un guion de la 1.7 mezclado: sin abiertos de alguien no se puede medir su mesa.
  expect(plana([21, '18/40'], '18/40')[0]).toBe(plana([21, 18], 18)[0])
})

test('carreraDe: un solo corredor eres tú, con la liebre en la meta', () => {
  expect(plana([16], 16)[0]).toBe('  16 (Tú)')
  expect(plana([16], 16)[2]?.startsWith('🏁🐇')).toBe(true)
})

test('carreraDe: la liebre en la meta, tú donde te toca, y nada pasa del ancho', () => {
  const [cifras, flechas, pista] = plana([21, 18, 11, 7, 3], 18)
  expect(cifras).toBe('  21      18 (Tú)             11         7          3')
  expect(flechas).toBe('  ▼       ▼                   ▼          ▼          ▼')
  expect(pista?.startsWith('🏁🐇')).toBe(true)
  expect(pista?.endsWith('🚦')).toBe(true)
  for (const f of [cifras, flechas, pista]) expect(anchoEnTerminal(f ?? '')).toBeLessThan(65)
})

test('carreraDe: quien empata contigo o va pegado detrás retrocede', () => {
  expect(plana([21, 18, 18, 11, 7, 3], 18)[0]).toBe('  21      18 (Tú) 18          11         7          3')
  expect(plana([21, 18, 17, 11, 7, 3], 18)[0]).toBe('  21      18 (Tú) 17          11         7          3')
})

test('carreraDe: quien va pegado delante se aparta hacia la meta', () => {
  expect(plana([21, 19, 18, 11, 7, 3], 18)[0]).toBe('  21   19 18 (Tú)             11         7          3')
})

test('carreraDe: los demás que empatan son una tortuga con ×n', () => {
  expect(plana([21, 18, 11, 7, 7, 3], 18)[0]).toBe('  21      18 (Tú)             11         7×2        3')
})

test('carreraDe: pegada a la salida tu etiqueta se lee al revés', () => {
  const [cifras, , pista] = plana([21, 15, 11, 7, 0], 0)
  expect(cifras?.endsWith('(Tú) 0')).toBe(true)
  expect(pista?.endsWith('🐢🚦')).toBe(true)
})

test('carreraDe: si vas primero la liebre es tuya; sin cierres o sin ancho no hay carrera', () => {
  expect(plana([21, 15, 11], 21)[0]?.startsWith('  21 (Tú)')).toBe(true)
  expect(plana([0, 0], 0)).toEqual([])
  expect(plana([5, 3], 3, 20)).toEqual([])
})
