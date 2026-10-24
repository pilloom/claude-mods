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
 * Un disco en memoria con los ficheros que el panel lee y escribe.
 *
 * Cada ruta se contesta por separado: con un `fs.exists` que dice `true` a
 * todo, NOTAS.md recibe el Markdown de la mesa y el post-it sale con los
 * tickets dentro. Una ruta que no está es el fichero que ese repositorio no
 * tiene, que para las notas es el caso normal.
 *
 * El `mtime` sube en cada escritura, porque es la condición con la que el panel
 * decide releer: con uno fijo, una nota escrita no se vería hasta cambiarlo.
 */
function ficheros(on: On, root: string, mesa?: string, notas?: string): Map<string, string> {
  const disco = new Map<string, string>()
  if (mesa !== undefined) disco.set(`${root}/docs/MI-MESA.md`, mesa)
  if (notas !== undefined) disco.set(`${root}/NOTAS.md`, notas)
  let version = 1
  on('session.root', async () => ({ value: root }))
  on('fs.exists', async (_, e) => ({ value: disco.has(e.path) }))
  on('fs.stat', async (_, e) => ({
    value: { kind: 'file' as const, size: (disco.get(e.path) ?? '').length, mtimeMs: version, isLink: false },
  }))
  on('fs.read', async (_, e) => ({ value: disco.get(e.path) ?? '' }))
  on('fs.write', async (_, e) => {
    disco.set(e.path, e.text)
    version += 1
    return { value: undefined }
  })
  return disco
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
 */
function leido(res: { result?: unknown }): string {
  const { content } = (res.result ?? {}) as { content?: { text?: string }[] }
  return content?.[0]?.text ?? ''
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
