import { expect, test } from 'claude-code/testing'

import { agrupar, consultas, emojiDeTipo, generar, inicioDeLaSemana, lineaDe, problemaDeConfig, tramoDe } from './generador'
import type { Cliente, ConfigJira, Issue } from './generador'
import { base64, clienteJira } from './jira'
import { parseMesa } from './parse'

const CFG: ConfigJira = {
  url: 'https://x.atlassian.net',
  email: 'yo@x.test',
  token: 't',
  proyecto: 'ABC',
  team: '',
  noHilos: ['backend'],
}

function i(key: string, labels: string[] = [], tipo = 'Task', updated = '2026-11-10T00:00:00Z'): Issue {
  return {
    key,
    fields: {
      summary: key,
      labels,
      updated,
      priority: { name: 'Medium' },
      status: { statusCategory: { key: 'new' } },
      issuetype: { name: tipo, subtask: false, hierarchyLevel: tipo === 'Epic' ? 1 : 0 },
      assignee: { accountId: 'yo', displayName: 'Yo' },
    },
  }
}

test('la semana abre el martes y el tramo lo dice como la mesa', () => {
  // 2026-11-15 es domingo: la semana empezó el martes 10.
  const domingo = new Date(2026, 10, 15, 12)
  expect(inicioDeLaSemana(domingo)).toBe('2026-11-10')
  expect(tramoDe(domingo)).toBe('MAR-DOM')
  const martes = new Date(2026, 10, 10, 9)
  expect(inicioDeLaSemana(martes)).toBe('2026-11-10')
  expect(tramoDe(martes)).toBe('MAR')
  // El lunes es el último día de la semana que acaba, no el primero de otra.
  expect(inicioDeLaSemana(new Date(2026, 10, 16, 9))).toBe('2026-11-10')
})

test('cada ticket sale una vez, en su hilo más grande, y lo de sin etiqueta va aparte', () => {
  const g = agrupar([i('A-1', ['pagos', 'backend']), i('A-2', ['pagos', 'login']), i('A-3', ['login']), i('A-4', ['pagos']), i('A-5')], CFG.noHilos)
  const por = Object.fromEntries(g.map(x => [x.hilo, x.issues.map(y => y.key)]))
  expect(por).toEqual({ pagos: ['A-1', 'A-2', 'A-4'], login: ['A-3'], 'sin hilo': ['A-5'] })
  // Los otros hilos van con `+`, sin los que se dijo que no son hilo.
  expect(lineaDe(i('A-2', ['pagos', 'login', 'backend']), 'pagos', 'yo', CFG.noHilos)).toContain('+login')
  expect(lineaDe(i('A-1', ['pagos', 'backend']), 'pagos', 'yo', CFG.noHilos)).not.toContain('+')
})

test('el tipo se pinta en cualquier idioma, y el que no se conoce es ❔', () => {
  expect(emojiDeTipo(i('A-1', [], 'Bug'))).toBe('🐞')
  expect(emojiDeTipo(i('A-1', [], 'Error'))).toBe('🐞')
  expect(emojiDeTipo(i('A-1', [], 'Historia'))).toBe('📖')
  expect(emojiDeTipo(i('A-1', [], 'Tarea'))).toBe('✅')
  expect(emojiDeTipo(i('A-1', [], 'Spike'))).toBe('❔')
})

test('el Team va por su UUID y por el id del campo de esa instancia', () => {
  expect(problemaDeConfig({ ...CFG, team: 'Frontend' })).toMatch(/UUID/)
  expect(problemaDeConfig({ ...CFG, url: 'http://x' })).toMatch(/https/)
  expect(problemaDeConfig(CFG)).toBeUndefined()
  const team = '7d62bf4c-0211-44f8-8533-7c8f50da0fb6'
  const q = consultas({ ...CFG, team }, 10042, '2026-11-10')
  expect(q.abiertos).toBe(`project = "ABC" AND cf[10042] = "${team}" AND statusCategory != Done`)
  expect(q.cerrados).toContain('resolutiondate >= "2026-11-10"')
})

test('lo que escribe el generador lo lee el panel: hilos, tickets y pulso', async () => {
  const cliente: Cliente = {
    yo: async () => ({ accountId: 'yo', displayName: 'Yo' }),
    campoTeam: async () => undefined,
    buscar: async jql =>
      jql.includes('currentUser()')
        ? [i('ABC-1', ['pagos']), i('ABC-2', [], 'Epic')]
        : jql.includes('resolutiondate')
          ? [i('ABC-3')]
          : jql.includes('created')
            ? []
            : [i('ABC-1')],
  }
  const md = await generar(cliente, CFG, new Date(2026, 10, 15, 12))
  const m = parseMesa(md, 1)
  expect(m.generated).toBe('2026-11-15')
  expect(m.hilos.map(h => [h.title, h.tickets.map(t => t.key)])).toEqual([['pagos (1)', ['ABC-1']]])
  expect(m.pulso).toMatchObject({ tramo: 'MAR-DOM', abren: 0, cierran: 1, tuyos: 1, pendientes: 1, meta: 2 })
  // La épica no entra en la mesa: se cuenta al pie.
  expect(md).toContain('**1 épica** tuya')
})

test('un Team con censo vacío es un error, no una mesa vacía', async () => {
  const cliente: Cliente = {
    yo: async () => ({ accountId: 'yo', displayName: 'Yo' }),
    campoTeam: async () => 10001,
    buscar: async () => [],
  }
  const team = '7d62bf4c-0211-44f8-8533-7c8f50da0fb6'
  await expect(generar(cliente, { ...CFG, team }, new Date())).rejects.toThrow(/revisa el UUID/)
})

test('el cliente pagina con nextPageToken y autentica en base64 UTF-8', async () => {
  expect(base64('yo@x.test:t')).toBe('eW9AeC50ZXN0OnQ=')
  expect(base64('ñ')).toBe('w7E=')
  const vistas: { auth: string | undefined; token: unknown }[] = []
  const c = clienteJira(async (_url, init) => {
    const body = JSON.parse(init?.body ?? '{}') as { nextPageToken?: string }
    vistas.push({ auth: init?.headers?.Authorization, token: body.nextPageToken })
    const primera = body.nextPageToken === undefined
    return {
      status: 200,
      ok: true,
      text: JSON.stringify(primera ? { issues: [i('A-1')], nextPageToken: 'p2', isLast: false } : { issues: [i('A-2')], isLast: true }),
    }
  }, CFG)
  const todos = await c.buscar('project = "ABC"', ['summary'])
  expect(todos.map(x => x.key)).toEqual(['A-1', 'A-2'])
  expect(vistas.map(v => v.token)).toEqual([undefined, 'p2'])
  expect(vistas[0]?.auth).toBe(`Basic ${base64('yo@x.test:t')}`)
})


test('con «Carrera con nombres» el generador escribe los nombres, y apagado no', async () => {
  const de = (key: string, id: string, nombre: string): Issue => {
    const x = i(key)
    x.fields.assignee = { accountId: id, displayName: nombre }
    return x
  }
  const cliente: Cliente = {
    yo: async () => ({ accountId: 'yo', displayName: 'Yo' }),
    campoTeam: async () => undefined,
    buscar: async jql =>
      jql.includes('currentUser()')
        ? [i('ABC-1')]
        : jql.includes('resolutiondate')
          ? [i('ABC-3'), de('ABC-4', 'm', 'Miguel Ángel Canto Poot'), de('ABC-5', 'm', 'Miguel Ángel Canto Poot')]
          : jql.includes('created')
            ? []
            : [i('ABC-1'), de('ABC-6', 'w', 'Wilberth | Sansores')],
  }
  const hoy = new Date(2026, 10, 15, 12)
  const apagado = await generar(cliente, CFG, hoy)
  expect(apagado).not.toContain('nombres:')
  expect(apagado).not.toContain('Miguel')
  const md = await generar(cliente, { ...CFG, nombres: true }, hoy)
  expect(md).toContain('carrera: 2/0 1/1 0/1')
  expect(md).toContain('nombres: Miguel Ángel Canto Poot | Tú | Wilberth Sansores')
  expect(parseMesa(md, 1).pulso?.carrera?.map(d => d.nombre)).toEqual(['Miguel Ángel Canto Poot', 'Tú', 'Wilberth Sansores'])
})
