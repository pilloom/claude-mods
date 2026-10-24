import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

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
 * Los dos ficheros que lee el panel, cada uno contestado por su ruta.
 *
 * Importa separarlos: con un `fs.exists` que dice `true` a todo, NOTAS.md
 * recibe el Markdown de la mesa y el post-it sale con los tickets dentro. Un
 * fichero a `undefined` es el que ese repositorio no tiene, que para las notas
 * es el caso normal.
 */
function ficheros(on: On, root: string, mesa?: string, notas?: string): void {
  const porRuta = (path: string): string | undefined =>
    path === `${root}/docs/MI-MESA.md` ? mesa : path === `${root}/NOTAS.md` ? notas : undefined
  on('session.root', async () => ({ value: root }))
  on('fs.exists', async (_, e) => ({ value: porRuta(e.path) !== undefined }))
  on('fs.stat', async (_, e) => ({
    value: { kind: 'file' as const, size: (porRuta(e.path) ?? '').length, mtimeMs: 1, isLink: false },
  }))
  on('fs.read', async (_, e) => ({ value: porRuta(e.path) ?? '' }))
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
