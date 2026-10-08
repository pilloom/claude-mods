import { expect, test } from 'claude-code/testing'

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

test('el panel pinta los tickets de la mesa en terminal y desktop', async ($, on) => {
  on('session.root', async () => ({ value: '/x/RBSistemas/lanzadera/backend_lanzadera' }))
  on('fs.exists', async () => ({ value: true }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: MD.length, mtimeMs: 1, isLink: false } }))
  on('fs.read', async () => ({ value: MD }))
  const titles: string[] = []
  on('ui.open', async (_, e) => {
    titles.push(e.title ?? '')
    return { value: { isPlaced: true } }
  })
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
    await ui.unmount()
  }
})

test('en un repo sin docs/MI-MESA.md lo dice, con el nombre del repo', async ($, on) => {
  on('session.root', async () => ({ value: '/x/RBSistemas/lanzadera/frontend_lanzadera' }))
  on('fs.exists', async () => ({ value: false }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  await $.command.run({ command: 'mi-mesa', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'mi-mesa', surface: 'terminal', component: 'Pane', requestId: 'mi-mesa', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /No hay docs\/MI-MESA.md en frontend_lanzadera/ })).toBeDefined()
  await ui.unmount()
})

const ROOT = '/x/RBSistemas/lanzadera/backend_lanzadera'
const HIST = [
  JSON.stringify({ display: 'ya hice el merge del 23', timestamp: Date.UTC(2026, 9, 8, 12, 0), project: ROOT }),
  JSON.stringify({ display: '/clear', timestamp: Date.UTC(2026, 9, 8, 12, 5), project: ROOT }),
  JSON.stringify({ display: 'abre el ticket y diles a ellos', timestamp: Date.UTC(2026, 9, 8, 12, 30), project: ROOT }),
].join('\n')

test('el cuarto de abajo pinta los últimos mensajes, sin las barras', async ($, on) => {
  on('session.root', async () => ({ value: ROOT }))
  on('fs.exists', async () => ({ value: true }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: MD.length, mtimeMs: 1, isLink: false } }))
  on('fs.read', async () => ({ value: MD }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
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
  on('session.root', async () => ({ value: ROOT }))
  on('fs.exists', async () => ({ value: true }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: MD.length, mtimeMs: 1, isLink: false } }))
  on('fs.read', async () => ({ value: MD }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
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
