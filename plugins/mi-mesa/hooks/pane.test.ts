import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseNotas } from './parse'

const MD = [
  '> 🤖 **Generado** por `scripts/qa/listar-mi-mesa.js` el 2026-10-07, para **X**.',
  '',
  '## origen-qa-conductor-20261004 (1 de 4) — hoy',
  '',
  '```',
  '▶  LAN-2669  ALTA La limpieza de tokens FCM muertos borra en auth y el…  +token-fcm-dos-almacenes',
  '```',
  '',
  '## bucle-sondeo-sin-latido (6) — hace 2 días',
  '',
  '```',
  '🚧 LAN-2678  baja Mandar positionAgeMs en el probe-ack (bloqueado hasta…  +medicion-04oct2026',
  '```',
].join('\n')

const ROOT = '/x/RBSistemas/lanzadera/backend_lanzadera'

/**
 * El `mtime` de cada fichero del disco en memoria, que sube en cada escritura.
 *
 * Es del módulo y no del `ficheros` de cada test —que lo vacía al empezar—
 * porque hay un fichero que no escribe el mod: la mesa que reescribe el guion
 * de regenerar. `pon` es la única manera de cambiarla de forma que el panel la
 * relea, porque `$.fs.write` desde un hook del test lo rechaza el motor: solo
 * lo llama quien lo tiene en su módulo de hooks.
 */
const versiones = new Map<string, number>()

/** Escribe un fichero del disco en memoria como lo haría algo de fuera del mod. */
function pon(disco: Map<string, string>, path: string, text: string): void {
  disco.set(path, text)
  versiones.set(path, (versiones.get(path) ?? 1) + 1)
}

/**
 * Un disco en memoria con los ficheros que el panel lee y escribe.
 *
 * Cada ruta se contesta por separado: con un `fs.exists` que dice `true` a
 * todo, NOTAS.md recibe el Markdown de la mesa y el post-it sale con los
 * tickets dentro. Una ruta que no está es el fichero que ese repositorio no
 * tiene, que para las notas es el caso normal.
 *
 * El `mtime` sube en cada escritura, y es de cada fichero: es la condición con
 * la que el panel decide releer, y con un contador compartido escribir en los
 * ignores del clon haría releer el post-it, que es lo que en el disco de verdad
 * no pasa.
 *
 * `.git/info` entra como una ruta más para que el mod encuentre dónde apuntar
 * el post-it; un repositorio que no la tenga es el worktree o la carpeta que no
 * es un clon, y ahí no se apunta nada.
 */
function ficheros(on: On, root: string, mesa?: string, notas?: string, git = true): Map<string, string> {
  const disco = new Map<string, string>()
  if (mesa !== undefined) disco.set(`${root}/docs/MI-MESA.md`, mesa)
  if (notas !== undefined) disco.set(`${root}/NOTAS.md`, notas)
  if (git) disco.set(`${root}/.git/info`, '')
  versiones.clear()
  on('session.root', async () => ({ value: root }))
  on('fs.exists', async (_, e) => ({ value: disco.has(e.path) }))
  on('fs.stat', async (_, e) => ({
    value: {
      kind: 'file' as const,
      size: (disco.get(e.path) ?? '').length,
      mtimeMs: versiones.get(e.path) ?? 1,
      isLink: false,
    },
  }))
  on('fs.read', async (_, e) => ({ value: disco.get(e.path) ?? '' }))
  on('fs.write', async (_, e) => {
    disco.set(e.path, e.text)
    versiones.set(e.path, (versiones.get(e.path) ?? 1) + 1)
    return { value: undefined }
  })
  return disco
}

/** El post-it no está en git, que es el caso normal una vez el mod lo apunta. */
function sinGit(on: On): void {
  on('process.run', async () => ({
    value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}

/** El panel se deja abrir, y el test se queda con los títulos que pidió. */
function abre(on: On, titles: string[] = []): string[] {
  on('ui.open', async (_, e) => {
    titles.push(e.title ?? '')
    return { value: { isPlaced: true } }
  })
  return titles
}

test('el panel pinta los tickets de la mesa en terminal y desktop', async ($, on) => {
  ficheros(on, '/x/RBSistemas/lanzadera/backend_lanzadera', MD)
  const titles = abre(on)
  // origin/presentation y las props del Pane los pone el engine en una sesión;
  // el panel no los lee, así que el test no los inventa.
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  expect(titles).toEqual(['Mi mesa · backend_lanzadera'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'mi-mesa', surface, component: 'Pane', requestId: 'mi-mesa', props: {} as never })
    expect(await ui.find({ type: 'Text', text: /MI MESA · BACKEND_LANZADERA/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 tickets · 2 hilos · generada 2026-10-07/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🚧 LAN-2678/ })).toBeDefined()
    // Sin NOTAS.md no hay post-it ni el hueco de su rótulo.
    expect(await ui.find({ type: 'Text', text: /NOTAS/ })).toBeUndefined()
    await ui.unmount()
  }
})

/**
 * El panel pinta el tipo del ticket entre la marca de estado y la clave, y solo
 * si la mesa escribe esa columna: los guiones generadores de los repositorios
 * se portan de uno en uno, así que el panel tiene que dibujar bien las dos.
 */
test('el panel pinta el tipo del ticket cuando la mesa lo trae', async ($, on) => {
  ficheros(on, ROOT, MD.replace('▶  LAN-2669', '▶  🐞 LAN-2669').replace('🚧 LAN-2678', '🚧 📖 LAN-2678'))
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /▶ 🐞 LAN-2669 ALTA/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🚧 📖 LAN-2678 baja/ })).toBeDefined()
  await ui.unmount()
})

test('en un repo sin docs/MI-MESA.md lo dice, con el nombre del repo', async ($, on) => {
  ficheros(on, '/x/RBSistemas/lanzadera/frontend_lanzadera')
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /No hay docs\/MI-MESA.md en frontend_lanzadera/ })).toBeDefined()
  await ui.unmount()
})

const HIST = [
  JSON.stringify({ display: 'ya hice el merge del 23', timestamp: Date.UTC(2026, 9, 8, 12, 0), project: ROOT }),
  JSON.stringify({ display: '/clear', timestamp: Date.UTC(2026, 9, 8, 12, 5), project: ROOT }),
  JSON.stringify({ display: 'abre el ticket y diles a ellos', timestamp: Date.UTC(2026, 9, 8, 12, 30), project: ROOT }),
].join('\n')

test('el cuarto de abajo pinta los últimos mensajes, sin las barras', async ($, on) => {
  ficheros(on, ROOT, MD)
  abre(on)
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: HIST, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    // 40 filas de cuerpo: el panel reserva 10 para el cuarto de abajo.
    props: { scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  expect(await ui.find({ type: 'Text', text: 'Últimos mensajes (2)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /abre el ticket y diles a ellos/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ya hice el merge del 23/ })).toBeDefined()
  // `/clear` es una orden al host, no un mensaje: no entra.
  expect(await ui.find({ type: 'Text', text: /\/clear/ })).toBeUndefined()
  // La línea que divide: una raya fina de ancho completo, en su propia fila.
  expect(await ui.find({ type: 'Text', text: /^─{30,}$/ })).toBeDefined()
  // Los tickets de la mesa siguen arriba: partir no se come la sección de arriba.
  expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
  await ui.unmount()
})

test('sin historial legible el cuarto de abajo lo dice en vez de desaparecer', async ($, on) => {
  ficheros(on, ROOT, MD)
  abre(on)
  on('process.run', async () => ({
    value: { exitCode: 1, stdout: '', stderr: 'no such file', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  // Sin props de Pane tampoco: el panel no parte y las dos secciones van seguidas.
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: 'Últimos mensajes (0)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Nada todavía en este repo.' })).toBeDefined()
  await ui.unmount()
})

const NOTAS = ['# Notas', '', '- Pedir las claves de staging a Marta', 'El deploy del viernes no va', ''].join('\n')

test('con NOTAS.md el post-it sale arriba, y la mesa sigue debajo', async ($, on) => {
  ficheros(on, ROOT, MD, NOTAS)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'mi-mesa',
      surface,
      component: 'Pane',
      props: { scroll: { offset: 0, bodyRows: 40 } } as never,
      requestId: 'mi-mesa',
    })
    expect(await ui.find({ type: 'Text', text: /^ NOTAS +$/ })).toBeDefined()
    // La viñeta de Markdown se cambia por una sola, y la cabecera no se pinta.
    expect(await ui.find({ type: 'Text', text: '• Pedir las claves de staging a Marta' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'El deploy del viernes no va' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /MI MESA · BACKEND_LANZADERA/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
    await ui.unmount()
  }
})

test('un post-it más largo de lo que cabe dice cuántas notas quedan', async ($, on) => {
  abre(on)
  ficheros(on, ROOT, MD, ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'].join('\n'))
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  expect(await ui.find({ type: 'Text', text: /^ NOTAS · \+2 +$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'cinco' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'seis' })).toBeUndefined()
  await ui.unmount()
})

test('un NOTAS.md sin ninguna línea útil no deja el rótulo solo', async ($, on) => {
  ficheros(on, ROOT, MD, '# Notas\n\n---\n\n')
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /NOTAS/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /MI MESA/ })).toBeDefined()
  await ui.unmount()
})

/** Un turno acabado, con lo que `turn.complete` cambia de un caso a otro. */
function turno(fields: Record<string, unknown>): never {
  return { answer: 'listo', durationMs: 120, isAborted: false, turnId: 't1', reason: 'answer', ...fields } as never
}

test('suena al contestar, y solo una vez por turno del bucle principal', async ($, on) => {
  const clips: string[] = []
  // El hook lanza el clip sin esperarlo: `settle` es el paso entre soltar el
  // envío y mirar qué hizo.
  const clock = mock.clock(on)
  ficheros(on, ROOT, MD)
  on('audio.play', async (_, e) => {
    clips.push('asset' in e.clip ? (e.clip.asset ?? '?') : '?')
    return { value: undefined }
  })
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  await $.turn.complete(turno({}))
  // El turno de un subagente no suena: con cinco, un turno sonaría seis veces.
  await $.turn.complete(turno({ agentId: 'a1' }))
  await clock.settle()
  expect(clips).toEqual(['sounds/listo.wav'])
})

test('una interrupción, un error o un rechazo no suenan', async ($, on) => {
  const clips: string[] = []
  const clock = mock.clock(on)
  ficheros(on, ROOT, MD)
  on('audio.play', async () => {
    clips.push('sonó')
    return { value: undefined }
  })
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  await $.turn.complete(turno({ reason: 'aborted', isAborted: true }))
  await $.turn.complete(turno({ reason: 'error' }))
  await $.turn.complete(turno({ reason: 'refusal', refusal: { category: null, explanation: null } }))
  await clock.settle()
  expect(clips).toEqual([])
})

test('con el sonido apagado en /config no suena nada', { options: { sonido: false } }, async ($, on) => {
  const clips: string[] = []
  const clock = mock.clock(on)
  ficheros(on, ROOT, MD)
  on('audio.play', async () => {
    clips.push('sonó')
    return { value: undefined }
  })
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  await $.turn.complete(turno({}))
  await clock.settle()
  expect(clips).toEqual([])
})

test('el turno sigue adelante aunque el clip falle', async ($, on) => {
  const clock = mock.clock(on)
  ficheros(on, ROOT, MD)
  on('audio.play', async () => {
    throw new Error('no hay afplay en esta máquina')
  })
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  const res = await $.turn.complete(turno({ answer: 'la respuesta entera' }))
  await clock.settle()
  expect(res.text).toEqual('la respuesta entera')
})

const NOTAS_FILE = `${ROOT}/NOTAS.md`

/**
 * Lo que el modelo lee de una llamada a la herramienta.
 *
 * No es `res.text`: ese lo pone el núcleo para las herramientas que ejecuta él,
 * y está ausente cuando el que contesta es un hook con su propio `result`.
 *
 * Se exige que sea una cadena, y no se acepta lo que venga: el esquema de
 * salida que el núcleo le pone a una herramienta de un mod admite `string`,
 * lista de bloques o nada, y devolviendo un `{ content: [...] }` el panel
 * escribía la nota pero la llamada contestaba error. Aquí no se validaba el
 * esquema, así que los tests pasaban con la forma que el motor rechaza; esta
 * comprobación es la que lo sujeta.
 */
function leido(res: { result?: unknown }): string {
  expect(typeof res.result).toEqual('string')
  return (res.result ?? '') as string
}

test('/nota escribe la nota y el panel la enseña sin esperar el ciclo', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  abre(on)
  const { text } = await $.command.run({ command: 'nota', args: 'el deploy del viernes no va' } as never)
  expect(text).toEqual('Añadida a NOTAS.md (1 en total).')
  // Un repositorio sin post-it lo estrena con su cabecera.
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- el deploy del viernes no va\n')
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: '• el deploy del viernes no va' })).toBeDefined()
  await ui.unmount()
})

test('/nota sin argumentos lista, y no añade una nota vacía', async ($, on) => {
  const disco = ficheros(on, ROOT, MD, '# Notas\n\n- una cosa\n')
  abre(on)
  const { text } = await $.command.run({ command: 'nota', args: '' } as never)
  expect(text).toEqual('1 nota en NOTAS.md:\n• una cosa')
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- una cosa\n')
})

test('/nota --quitar quita la que casa', async ($, on) => {
  const disco = ficheros(on, ROOT, MD, '# Notas\n\n- llamar al banco\n- firmar el anexo\n')
  abre(on)
  const { text } = await $.command.run({ command: 'nota', args: '--quitar banco' } as never)
  expect(text).toEqual('Quitada de NOTAS.md: llamar al banco')
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- firmar el anexo\n')
})

test('la herramienta añade, lista y quita, y el modelo lee qué pasó', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  abre(on)
  const llamar = async (accion: string, texto?: string) =>
    await $.tool.call({ tool: 'mcp__mi-mesa__nota', accion, texto } as never)

  const puesta = await llamar('anadir', 'pedir las claves de staging')
  expect(leido(puesta)).toEqual('Añadida a NOTAS.md (1 en total).')
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- pedir las claves de staging\n')

  const lista = await llamar('listar')
  expect(leido(lista)).toEqual('1 nota en NOTAS.md:\n• pedir las claves de staging')

  const fuera = await llamar('quitar', 'claves')
  expect(leido(fuera)).toEqual('Quitada de NOTAS.md: pedir las claves de staging')
  expect(parseNotas(disco.get(NOTAS_FILE) ?? '', 1).lines).toEqual([])
})

test('quitar con varias candidatas no toca el fichero y lo dice', async ($, on) => {
  const antes = '# Notas\n\n- llamar al banco\n- volver a llamar al banco\n'
  const disco = ficheros(on, ROOT, MD, antes)
  abre(on)
  const res = await $.tool.call({ tool: 'mcp__mi-mesa__nota', accion: 'quitar', texto: 'banco' } as never)
  expect(leido(res)).toEqual(
    '«banco» casa con 2 notas y no se quitó ninguna. Hay que concretar:\nllamar al banco\nvolver a llamar al banco',
  )
  expect(disco.get(NOTAS_FILE)).toEqual(antes)
})

test('una acción que no es ninguna de las tres no escribe nada', async ($, on) => {
  const antes = '# Notas\n\n- una cosa\n'
  const disco = ficheros(on, ROOT, MD, antes)
  abre(on)
  // El esquema la valida, pero el valor llega como lo mande el modelo.
  const res = await $.tool.call({ tool: 'mcp__mi-mesa__nota', accion: 'borrar todo', texto: 'x' } as never)
  expect(leido(res)).toEqual('1 nota en NOTAS.md:\n• una cosa')
  expect(disco.get(NOTAS_FILE)).toEqual(antes)
})

const EXCLUDE = `${ROOT}/.git/info/exclude`

test('el post-it se apunta solo en los ignores de este clon, y una sola vez', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'nota', args: 'pedir las claves de staging' } as never)
  // En .git/info/exclude y no en el .gitignore: el post-it es de quien tiene el
  // clon, y el .gitignore lo ve el equipo entero en el diff.
  expect(disco.get(EXCLUDE)).toEqual(
    '# El post-it de «Mi mesa»: notas de quien usa este clon.\n/NOTAS.md\n',
  )
  expect(disco.has(`${ROOT}/.gitignore`)).toEqual(false)
  await $.command.run({ command: 'nota', args: 'firmar el anexo' } as never)
  expect(disco.get(EXCLUDE)).toEqual(
    '# El post-it de «Mi mesa»: notas de quien usa este clon.\n/NOTAS.md\n',
  )
})

test('un .gitignore que ya lo ignora no se duplica en los ignores del clon', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(`${ROOT}/.gitignore`, '.DS_Store\n/NOTAS.md\n')
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'nota', args: 'una cosa' } as never)
  expect(disco.has(EXCLUDE)).toEqual(false)
})

test('sin .git no se apunta nada y el post-it funciona igual', async ($, on) => {
  const disco = ficheros(on, ROOT, MD, undefined, false)
  sinGit(on)
  abre(on)
  const { text } = await $.command.run({ command: 'nota', args: 'una cosa' } as never)
  expect(text).toEqual('Añadida a NOTAS.md (1 en total).')
  expect(disco.has(EXCLUDE)).toEqual(false)
})

test('si el repositorio ya versiona el post-it, el rótulo lo dice', async ($, on) => {
  ficheros(on, ROOT, MD, '# Notas\n\n- pedir las claves de staging\n')
  // `git ls-files --error-unmatch` lo encuentra: alguien lo commiteó antes de
  // que el mod lo apuntara, y de ahí no saca a nadie el exclude.
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: 'NOTAS.md\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  const rotulo = await ui.find({ type: 'Text', text: /SE SUBE A GIT: git rm --cached NOTAS\.md/u })
  expect(rotulo).toBeDefined()
  await ui.unmount()
})

test('una nota larga se enseña entera, en varias filas y no recortada', async ($, on) => {
  ficheros(on, ROOT, MD, '# Notas\n\n- pedir las claves de staging a Marta antes del jueves\n')
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 30, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  // Las filas son del ancho del cuerpo menos la equis de quitar y su espacio.
  expect(await ui.find({ type: 'Text', text: '• pedir las claves de' })).toBeDefined()
  // Lo que antes se perdía detrás del «…», sangrado bajo el texto de arriba.
  expect(await ui.find({ type: 'Text', text: '  staging a Marta antes del' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  jueves' })).toBeDefined()
  // Ninguna nota acaba en «…»; la mesa sí recorta, y eso se queda como está.
  expect(await ui.find({ type: 'Text', text: /^• .*…/u })).toBeUndefined()
  await ui.unmount()
})

test('con notas largas el post-it se para a la mitad y cuenta las que no caben', async ($, on) => {
  const largas = [
    'pedir las claves de staging a Marta antes del jueves',
    'revisar el contrato del latido antes de subir la rama',
    'llamar al banco para firmar el anexo del lunes',
  ]
  ficheros(on, ROOT, MD, `# Notas\n\n${largas.map(n => `- ${n}`).join('\n')}\n`)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 30, scroll: { offset: 0, bodyRows: 12 } } as never,
    requestId: 'mi-mesa',
  })
  // La primera nota son tres filas y la segunda ya no entra entera en las
  // cinco del tope: no se pinta a medias, se cuenta. Y la mesa no se queda
  // sin sitio debajo.
  expect(await ui.find({ type: 'Text', text: /^ NOTAS · \+2 +$/u })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  jueves' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /revisar el contrato/u })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /llamar al banco/u })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /MI MESA/u })).toBeDefined()
  await ui.unmount()
})

test('la equis de una nota la quita del fichero y del panel', async ($, on) => {
  const disco = ficheros(on, ROOT, MD, '# Notas\n\n- llamar al banco\n- firmar el anexo\n')
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 40, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  // Una equis por nota, cada una con su clave: la del panel es la de su sitio.
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(2)
  await ui.press({ key: 'quitar-0' })
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- firmar el anexo\n')
  // El panel no espera al ciclo de 15 s: la nota se va al pulsar.
  expect(await ui.find({ type: 'Text', text: '• llamar al banco' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '• firmar el anexo' })).toBeDefined()
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(1)
  await ui.unmount()
})

test('la equis quita la que señala aunque haya dos notas iguales', async ($, on) => {
  // Por el texto no se podría: `quitarNota` se niega con dos candidatas, y
  // hace bien. Por el sitio no hay duda que resolver.
  const disco = ficheros(on, ROOT, MD, '# Notas\n\n- llamar al banco\n- llamar al banco\n')
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 40, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  await ui.press({ key: 'quitar-1' })
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- llamar al banco\n')
  await ui.unmount()
})

test('la equis no borra la de al lado si el fichero cambió por debajo', async ($, on) => {
  const disco = ficheros(on, ROOT, MD, '# Notas\n\n- llamar al banco\n- firmar el anexo\n')
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 40, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  // Alguien edita NOTAS.md a mano y quita la primera: la nota número 0 ya es
  // otra, y la equis que se pulsa es la que se pintó antes.
  disco.set(NOTAS_FILE, '# Notas\n\n- firmar el anexo\n')
  await ui.press({ key: 'quitar-0' })
  // No se quita nada: el fichero se queda como lo dejó quien lo editó.
  expect(disco.get(NOTAS_FILE)).toEqual('# Notas\n\n- firmar el anexo\n')
  await ui.unmount()
})

/** La mesa después de regenerarla: un ticket más, para ver que se releyó. */
const MD2 = [
  '> 🤖 **Generado** por `scripts/qa/listar-mi-mesa.js` el 2026-10-09, para **X**.',
  '',
  '## origen-qa-conductor-20261004 (1 de 4) — hoy',
  '',
  '```',
  '▶  LAN-2669  ALTA La limpieza de tokens FCM muertos borra en auth y el…',
  '·  LAN-2700  med  Lo que entró al regenerar',
  '```',
].join('\n')

const GUION = `${ROOT}/scripts/qa/listar-mi-mesa.js`
const MESA_FILE = `${ROOT}/docs/MI-MESA.md`

/**
 * Contesta la confirmación del botón, y se queda con lo que se preguntó.
 *
 * `$.ui.ask` es una llamada a `AskUserQuestion` que pasa por todos los hooks
 * menos el de quien pregunta, así que el test la contesta como contestaría
 * cualquier otra herramienta: el resultado va **cuestionado por su pregunta**
 * —`{ answers: { [la pregunta]: la respuesta } }`—, que es la forma de la que
 * el motor saca la etiqueta elegida.
 *
 * `respuesta` puede ser cualquier cosa: contestar «Dejarlo», o el texto libre
 * del «Other», es lo mismo que no confirmar. Sin `respuesta` el hook revienta,
 * que es el diálogo cerrado con escape y la sesión en la que no hay a quién
 * preguntar (`-p`).
 *
 * Los dos casos van en un solo hook, y no en dos ayudantes, porque cada sitio
 * que registra `tool.call` con su matcher le cuesta a `tsc` un buen montón de
 * instanciaciones: con dos, este fichero se pasa del tope del compilador y lo
 * que sale es un `TS2589` que no habla de nada de esto.
 */
function contesta(on: On, respuesta?: string): string[] {
  const preguntas: string[] = []
  on('tool.call', { tool: 'AskUserQuestion' }, async (_, e) => {
    const pregunta = (e.questions[0] as { question?: string } | undefined)?.question ?? ''
    preguntas.push(pregunta)
    if (respuesta === undefined) throw new Error('nadie a quien preguntar')
    return { result: { answers: { [pregunta]: respuesta } } }
  })
  return preguntas
}

/**
 * El guion de la mesa, y un `process.run` que lo finge.
 *
 * La mesa nueva se escribe con `pon`, que sube el `mtime`: es la condición con
 * la que el panel decide releer, y sin subirlo el fichero cambiaría y el panel
 * seguiría enseñando el de antes, que no es lo que pasa con un guion de verdad.
 */
function conGuion(
  on: On,
  disco: Map<string, string>,
  salida?: { exitCode: number; stderr?: string },
): string[][] {
  const corridos: string[][] = []
  on('process.run', async (_, e) => {
    const argv = [...e.argv]
    corridos.push(argv)
    // El `tail` del historial pasa por aquí también: solo el guion escribe.
    if (argv[0] === 'node' && (salida?.exitCode ?? 0) === 0) pon(disco, MESA_FILE, MD2)
    return {
      value: {
        exitCode: argv[0] === 'node' ? (salida?.exitCode ?? 0) : 1,
        stdout: '',
        stderr: argv[0] === 'node' ? (salida?.stderr ?? '') : '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  return corridos
}

test('el ↻ corre el guion que nombra la cabecera y relee la mesa al momento', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  const corridos = conGuion(on, disco)
  const preguntas = contesta(on, 'Regenerar')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /generada 2026-10-07/ })).toBeDefined()
  await ui.press({ key: 'regenerar' })
  // Se pregunta con el comando entero delante, que es lo que se va a ejecutar.
  expect(preguntas).toEqual(['¿Regenerar la mesa con «node scripts/qa/listar-mi-mesa.js»?'])
  // Sin shell y con el intérprete puesto por la extensión, no por la cabecera.
  expect(corridos.filter(c => c[0] === 'node')).toEqual([['node', 'scripts/qa/listar-mi-mesa.js']])
  expect(await ui.find({ type: 'Text', text: /generada 2026-10-09/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /· LAN-2700 med/ })).toBeDefined()
  await ui.unmount()
})

test('sin guion en disco no se pinta el botón, que no podría hacer nada', async ($, on) => {
  ficheros(on, ROOT, MD)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Button', key: 'regenerar' })).toBeUndefined()
  await ui.unmount()
})

test('en un repo sin mesa todavía, el botón sale por la convención', async ($, on) => {
  // Es la primera generación: no hay fichero, así que no hay cabecera que leer,
  // y es justo cuando más falta hace el botón.
  const disco = ficheros(on, ROOT)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  const corridos = conGuion(on, disco)
  contesta(on, 'Regenerar')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /No hay docs\/MI-MESA.md/ })).toBeDefined()
  await ui.press({ key: 'regenerar' })
  expect(corridos.filter(c => c[0] === 'node')).toEqual([['node', 'scripts/qa/listar-mi-mesa.js']])
  expect(await ui.find({ type: 'Text', text: /· LAN-2700 med/ })).toBeDefined()
  await ui.unmount()
})

test('un guion que revienta lo dice en el panel y no lo tira', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  conGuion(on, disco, { exitCode: 2, stderr: 'Error: falta el token de Jira\n    en línea 40' })
  contesta(on, 'Regenerar')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  await ui.press({ key: 'regenerar' })
  expect(await ui.find({ type: 'Text', text: /salió con 2\. Error: falta/ })).toBeDefined()
  // La mesa de antes sigue puesta: lo que falló es la generación, no la lectura.
  expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
  await ui.unmount()
})

test('el guion de /config manda sobre la cabecera y sobre la convención', { options: { generador: 'tool/mio.js' } }, async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el de la cabecera')
  disco.set(`${ROOT}/tool/mio.js`, '// el mío')
  abre(on)
  const corridos = conGuion(on, disco)
  contesta(on, 'Regenerar')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  await ui.press({ key: 'regenerar' })
  expect(corridos.filter(c => c[0] === 'node')).toEqual([['node', 'tool/mio.js']])
  await ui.unmount()
})

test('decir que no deja la mesa como estaba y no corre nada', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  const corridos = conGuion(on, disco)
  contesta(on, 'Dejarlo')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  await ui.press({ key: 'regenerar' })
  expect(corridos.filter(c => c[0] === 'node')).toEqual([])
  expect(await ui.find({ type: 'Text', text: /generada 2026-10-07/ })).toBeDefined()
  // Y el botón vuelve a estar: no se queda colgado en «preguntando».
  expect(await ui.find({ type: 'Button', key: 'regenerar' })).toBeDefined()
  await ui.unmount()
})

test('un diálogo que no se contesta tampoco corre nada', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  const corridos = conGuion(on, disco)
  contesta(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  await ui.press({ key: 'regenerar' })
  expect(corridos.filter(c => c[0] === 'node')).toEqual([])
  expect(await ui.find({ type: 'Button', key: 'regenerar' })).toBeDefined()
  await ui.unmount()
})

test('la ↻ va dentro de la barra del título, pegada a su borde derecho', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  const barra = await ui.find({ type: 'Text', text: /^ MI MESA · BACKEND_LANZADERA +$/ })
  const boton = await ui.find({ type: 'Button', key: 'regenerar' })
  // La barra deja justo el hueco del glifo y sus dos espacios: las dos piezas
  // suman el ancho de la fila. Rellenándola a ancho completo, el botón se sale.
  expect(barra?.text.length).toEqual(53)
  expect(boton?.text).toEqual(' ↻ ')
  // `plain`: sin él el terminal le dibuja sus corchetes, y dentro de la barra
  // eso es un botón pegado encima del título en vez de parte de él.
  expect(boton?.props.plain).toEqual(true)
  // Y el glifo lleva el fondo de la barra, no el del panel: por eso va como
  // `Text` hijo y no como `label`, que un `Button` no tiene `inverse` propio.
  expect(JSON.stringify(boton?.children)).toContain('"inverse":true')
  await ui.unmount()
})

test('sin botón la barra del título vuelve a ser de ancho completo', async ($, on) => {
  // Sin guion no hay hueco que dejarle: el título se queda la fila entera.
  ficheros(on, ROOT, MD)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  const barra = await ui.find({ type: 'Text', text: /^ MI MESA · BACKEND_LANZADERA +$/ })
  expect(barra?.text.length).toEqual(56)
  await ui.unmount()
})

test('mientras corre, el aviso entra en la barra y se queda con el hueco', async ($, on) => {
  const disco = ficheros(on, ROOT, MD)
  disco.set(GUION, '// el guion de este repo')
  abre(on)
  // Un `process.run` que no vuelve deja el panel en mitad de la regeneración,
  // que es el estado que no se puede ver de otra manera.
  on('process.run', async (_, e) => {
    if (e.argv[0] === 'node') await new Promise(() => {})
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  contesta(on, 'Regenerar')
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  await ui.press({ key: 'regenerar' })
  expect(await ui.find({ type: 'Text', text: /REGENERANDO…/ })).toBeDefined()
  // Y no se deja pulsar otra vez: el aviso ocupa el sitio del botón.
  expect(await ui.find({ type: 'Button', key: 'regenerar' })).toBeUndefined()
  await ui.unmount()
})

/** Una mesa de un hilo con `n` tickets, que es lo que no cabe en el panel. */
function mesaLarga(n: number): string {
  const filas = Array.from(
    { length: n },
    (_, i) => `▶  LAN-${3000 + i}  ALTA Lo que toca en el ticket ${3000 + i}  +otro-hilo`,
  )
  return [
    '> 🤖 **Generado** por `scripts/qa/listar-mi-mesa.js` el 2026-10-07, para **X**.',
    '',
    '## hilo-largo (30) — hoy',
    '',
    '```',
    ...filas,
    '```',
  ].join('\n')
}

test('la mesa que no cabe se corta en una ventana y dice por dónde va', async ($, on) => {
  ficheros(on, ROOT, mesaLarga(30))
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    // 20 filas de cuerpo: la mesa trae 31 (el rótulo del hilo y 30 tickets).
    props: { scroll: { offset: 0, bodyRows: 20 } } as never,
    requestId: 'mi-mesa',
  })
  // Lo de arriba se pinta; lo de abajo, no: la ventana empieza por el principio.
  expect(await ui.find({ type: 'Text', text: /LAN-3000/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /LAN-3029/ })).toBeUndefined()
  // Y se dice, que una mesa cortada no se distingue de una que se acaba ahí.
  expect(await ui.find({ type: 'Text', text: / 1-\d+\/31 / })).toBeDefined()
  await ui.unmount()
})

test('las flechas mueven la ventana de la mesa, no el cuerpo del panel', async ($, on) => {
  ficheros(on, ROOT, mesaLarga(30))
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const props = { scroll: { offset: 0, bodyRows: 20 } } as never
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props,
    requestId: 'mi-mesa',
  })
  // Arriba del todo no hay nada que subir, y las dos flechas están puestas.
  expect(await ui.find({ type: 'Button', key: 'subir' })).toBeDefined()
  await ui.press({ key: 'bajar' })
  await ui.redraw(props)
  // Lo que estaba fuera entra, y lo de arriba sale: la ventana se movió.
  expect(await ui.find({ type: 'Text', text: /LAN-3012/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /LAN-3000/ })).toBeUndefined()
  // Otra flecha más y se llega al final, sin pasarse: la última fila es la 31
  // de 31, y de ahí no baja por mucho que se pulse.
  await ui.press({ key: 'bajar' })
  await ui.press({ key: 'bajar' })
  await ui.redraw(props)
  expect(await ui.find({ type: 'Text', text: /LAN-3029/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /-31\/31 / })).toBeDefined()
  // Y vuelve: subir deja otra vez el principio de la mesa.
  await ui.press({ key: 'subir' })
  await ui.press({ key: 'subir' })
  await ui.press({ key: 'subir' })
  await ui.redraw(props)
  expect(await ui.find({ type: 'Text', text: /LAN-3000/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / 1-\d+\/31 / })).toBeDefined()
  await ui.unmount()
})

test('la mesa que cabe entera no gana flechas ni indicador', async ($, on) => {
  ficheros(on, ROOT, MD)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  expect(await ui.find({ type: 'Button', key: 'bajar' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /\d+-\d+\/\d+/ })).toBeUndefined()
  await ui.unmount()
})

/**
 * La mesa con el marcador: una fila más en la cabecera de la sección, con las
 * cifras de la semana del Team y sin nombres.
 */
const CON_PULSO = [
  MD,
  '',
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

test('el panel pinta el marcador de la semana cuando la mesa lo trae', async ($, on) => {
  ficheros(on, ROOT, CON_PULSO)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  expect(await ui.find({ type: 'Text', text: /SEMANA MAR-LUN/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '+ 62' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '- 57' })).toBeDefined()
  // La mesa las cuenta y la fila no las pinta.
  expect(await ui.find({ type: 'Text', text: /subt/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '▼5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'tú 18 · 2.º/9' })).toBeDefined()
  // La sección del pulso no es un hilo: no entra en la cuenta de la mesa.
  expect(await ui.find({ type: 'Text', text: /2 tickets · 2 hilos/ })).toBeDefined()
  // Y la mesa sigue puesta debajo.
  expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
  await ui.unmount()
})

/** La mesa cuyo guion todavía no escribe la sección se pinta como siempre. */
test('sin la sección del pulso el panel no deja la fila en blanco', async ($, on) => {
  ficheros(on, ROOT, MD)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  expect(await ui.find({ type: 'Text', text: /SEMANA/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /▶ LAN-2669 ALTA/ })).toBeDefined()
  await ui.unmount()
})

/**
 * El marcador se queda una fila de la cabecera, así que la ventana de la mesa
 * tiene una menos: contarla de menos corre la ventana y la última línea se
 * pierde por debajo del corte sin que nada lo diga.
 *
 * Las dos mesas se comparan en un solo test y reescribiendo el fichero con
 * `pon`, que es como lo reescribe el guion de verdad: los hooks del disco en
 * memoria se registran una vez por test, antes de la primera llamada a `$`.
 */
test('el marcador le cuesta a la mesa una fila, y la cuenta lo dice', async ($, on) => {
  const lineas = ['> 🤖 **Generado** por `scripts/qa/listar-mi-mesa.js` el 2026-10-07, para **X**.', '']
  for (let i = 0; i < 6; i++) {
    lineas.push(`## hilo-${i} (1) — hoy`, '', '```', `·  LAN-${100 + i}  med  Lo que sea del hilo ${i}`, '```', '')
  }
  const base = lineas.join('\n')
  const disco = ficheros(on, ROOT, base)
  sinGit(on)
  abre(on)
  /** Dónde va la ventana de la mesa, tal como la línea de la cuenta lo dice. */
  const ventana = async (): Promise<string> => {
    await $.command.run({ command: 'mi-mesa', args: '' } as never)
    const ui = await $.ui.mount({
      plugin: 'mi-mesa',
      surface: 'terminal',
      component: 'Pane',
      // 16 filas de cuerpo: la mesa se queda 12 y no caben sus 17 líneas.
      props: { bodyColumns: 80, scroll: { offset: 0, bodyRows: 16 } } as never,
      requestId: 'mi-mesa',
    })
    const cuenta = await ui.find({ type: 'Text', text: /\d+-\d+\/\d+/ })
    const texto = typeof cuenta?.text === 'string' ? cuenta.text : ''
    await ui.unmount()
    return /(\d+-\d+\/\d+)/.exec(texto)?.[1] ?? ''
  }
  expect(await ventana()).toBe('1-10/17')
  pon(disco, `${ROOT}/docs/MI-MESA.md`, `${base}\n## Pulso\n\n\`\`\`\nabren: 62\ncierran: 57\n\`\`\`\n`)
  expect(await ventana()).toBe('1-9/17')
})

/**
 * Las dos líneas de cifras van **en negritas**, y es una decisión que se pierde
 * en silencio: con una en gris y la otra en color no se leen como el par que
 * son, y nada falla al volver a apagarlas.
 *
 * El `dimColor` **no** vuelve con ellas: `bold` y `dimColor` se pelean —uno baja
 * la intensidad y el otro la sube— y cada terminal resuelve ese par a su
 * manera, así que en el panel no se usan juntos en ninguna parte.
 */
test('la cuenta y el marcador van en negritas, y sin dimColor', async ($, on) => {
  ficheros(on, ROOT, CON_PULSO)
  sinGit(on)
  abre(on)
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'mi-mesa',
    surface: 'terminal',
    component: 'Pane',
    props: { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 } } as never,
    requestId: 'mi-mesa',
  })
  for (const texto of [/2 tickets · 2 hilos/, /SEMANA MAR-LUN/, '+ 62', '- 57', '▼5', 'tú 18 · 2.º/9'] as const) {
    const nodo = await ui.find({ type: 'Text', text: texto })
    expect(nodo, `falta la línea ${texto}`).toBeDefined()
    const props = (nodo?.props ?? {}) as { bold?: unknown; dimColor?: unknown }
    expect(props.bold, `${texto} tiene que ir en negritas`).toBe(true)
    expect(props.dimColor, `${texto} no puede ir apagada`).not.toBe(true)
  }
  await ui.unmount()
})
