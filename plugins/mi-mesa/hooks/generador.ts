/**
 * El generador de la mesa que trae el propio mod (desde la 1.10.0).
 *
 * Los guiones `listar-mi-mesa` viven **copiados** en cada repositorio, así que
 * una actualización del mod desde el marketplace no les llega: quien tenía una
 * copia de antes del pulso seguía sin pulso. Este corre dentro del mod, con lo
 * que se le pone en `/config`, y cada versión nueva del mod lo trae puesto.
 *
 * 🔑 **Todo se decide por estructura y no por nombre.** Lo usan equipos con su
 * propia instancia de Jira, en su idioma: lo hecho es `statusCategory`, la
 * subtarea es `issuetype.subtask`, la épica es `hierarchyLevel >= 1` y el
 * campo Team se busca por su tipo (`…:atlassian-team`), no por un
 * `customfield_10001` que es de una instancia. Los nombres solo eligen el emoji
 * y la prioridad corta, que es lo único que puede fallar sin mentir: sale `❔`.
 *
 * Aquí está lo puro —de issues a Markdown— y la orquestación sobre un cliente
 * que se le pasa; el cliente de verdad, con `$.http.fetch`, está en `jira.ts`.
 * El formato es el que lee `parseMesa` y el contrato del pulso, el de la
 * sección «Lo que el guion tiene que escribir» del README.
 */

/** Lo que el generador necesita saber, ya leído de `/config`. */
export type ConfigJira = {
  url: string
  email: string
  token: string
  proyecto: string
  /** UUID del Team, o vacío para el proyecto entero. */
  team: string
  /** Etiquetas que no forman hilo, en minúsculas. */
  noHilos: readonly string[]
  /**
   * «Carrera con nombres» (desde la 1.11.0): escribe la línea `nombres` del
   * pulso. Apagado, la mesa sale sin nombres, como siempre.
   */
  nombres?: boolean
}

/** Lo que llega de Jira de un issue, solo lo que se lee. */
export type Issue = {
  key: string
  fields: {
    summary?: string
    labels?: string[]
    updated?: string
    priority?: { name?: string } | null
    status?: { statusCategory?: { key?: string } } | null
    issuetype?: { name?: string; subtask?: boolean; hierarchyLevel?: number } | null
    assignee?: { accountId?: string; displayName?: string } | null
  }
}

/** Lo mínimo que el generador le pide a Jira. */
export type Cliente = {
  yo(): Promise<{ accountId: string; displayName: string }>
  /** El id numérico del campo Team, o `undefined` si la instancia no lo tiene. */
  campoTeam(): Promise<number | undefined>
  buscar(jql: string, campos: readonly string[]): Promise<Issue[]>
}

/** La semana abre el martes: el lunes es la cosecha de la que acaba. */
const DIA_QUE_ABRE = 2
const ABREV = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CLAVE_PROYECTO = /^[A-Z][A-Z0-9_]*$/u
const SIN_HILO = 'sin hilo'
const BLOQUEO = /^(bloqueado|blocked)/iu

/** `AAAA-MM-DD` en hora local. */
export function fechaLocal(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

/** El martes en que empezó la semana de `hoy`, como fecha local. */
export function inicioDeLaSemana(hoy: Date): string {
  const desde = (hoy.getDay() - DIA_QUE_ABRE + 7) % 7
  return fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - desde))
}

/** `MAR-JUE` un jueves, `MAR` el propio martes. */
export function tramoDe(hoy: Date): string {
  const abre = ABREV[DIA_QUE_ABRE] ?? 'MAR'
  const hasta = ABREV[hoy.getDay()] ?? ''
  return hasta === abre ? abre : `${abre}-${hasta}`
}

/** Si es subtarea; `null` si no se puede saber, que no es «no». */
export function esSubtarea(issue: Issue): boolean | null {
  const t = issue.fields.issuetype
  if (!t) return null
  if (typeof t.subtask === 'boolean') return t.subtask
  return null
}

/** Las épicas son contenedores: nadie «coge» una, y no cuentan. */
export function esEpica(issue: Issue): boolean {
  const t = issue.fields.issuetype
  if (typeof t?.hierarchyLevel === 'number') return t.hierarchyLevel >= 1
  return /^(epic|épica|epica)$/iu.test(t?.name?.trim() ?? '')
}

const BUG = /^(bug|error|fallo|defecto|incidencia)$/iu
const HISTORIA = /^(story|historia|user story|historia de usuario)$/iu
const TAREA = /^(task|tarea|sub-?task|sub-?tarea)$/iu

/** El emoji del tipo: lo único que se decide por nombre, y por eso cae en `❔`. */
export function emojiDeTipo(issue: Issue): string {
  const nombre = issue.fields.issuetype?.name?.trim() ?? ''
  if (BUG.test(nombre)) return '🐞'
  if (HISTORIA.test(nombre)) return '📖'
  if (issue.fields.issuetype?.subtask === true || TAREA.test(nombre)) return '✅'
  return '❔'
}

const PRIORIDAD: Record<string, string> = {
  highest: 'MAX',
  'más alta': 'MAX',
  critical: 'MAX',
  high: 'ALTA',
  alta: 'ALTA',
  medium: 'med',
  media: 'med',
  low: 'baja',
  baja: 'baja',
  lowest: 'min',
  'más baja': 'min',
}

/**
 * La prioridad en cuatro caracteres, para que las columnas casen.
 *
 * Sin espacios: el panel parte la línea por espacios, y una prioridad que no
 * está en la tabla y trae uno correría el resumen una columna.
 */
export function prioridadCorta(nombre: string | undefined): string {
  const n = (nombre ?? '').trim()
  if (!n) return '?'
  return PRIORIDAD[n.toLowerCase()] ?? n.replace(/\s+/gu, '').slice(0, 4)
}

/** Un texto en una línea y como mucho `maximo` caracteres, cortado en palabra. */
export function recortarTexto(texto: string | undefined, maximo: number): string {
  const limpio = String(texto ?? '')
    .replace(/`{3,}/gu, "'''")
    .replace(/\s+/gu, ' ')
    .trim()
  if (limpio.length <= maximo) return limpio
  const corte = limpio.slice(0, maximo - 1)
  const espacio = corte.lastIndexOf(' ')
  return `${espacio > maximo * 0.6 ? corte.slice(0, espacio) : corte}…`
}

/** Las etiquetas que hacen hilo: ni las de bloqueo ni las que se dijo que no. */
export function hilosDe(issue: Issue, noHilos: readonly string[]): string[] {
  return (issue.fields.labels ?? []).filter(l => {
    const e = String(l).toLowerCase()
    return !BLOQUEO.test(e) && !noHilos.includes(e)
  })
}

/** Una sección de la mesa: un hilo y sus tickets, cada ticket una sola vez. */
export type Grupo = { hilo: string; issues: Issue[]; ultima: number }

/**
 * Reparte los tickets en hilos sin repetir ninguno: cada uno va al hilo suyo
 * que **más tickets** tiene, y los demás salen detrás del resumen con `+`.
 * Lo que no tiene etiqueta va a «sin hilo». Los hilos, del más reciente al más
 * viejo, por la última actualización de sus tickets.
 */
export function agrupar(issues: readonly Issue[], noHilos: readonly string[]): Grupo[] {
  const tam = new Map<string, number>()
  for (const i of issues) for (const h of hilosDe(i, noHilos)) tam.set(h, (tam.get(h) ?? 0) + 1)
  const grupos = new Map<string, Grupo>()
  for (const i of issues) {
    const suyos = [...hilosDe(i, noHilos)].sort(
      (a, b) => (tam.get(b) ?? 0) - (tam.get(a) ?? 0) || a.localeCompare(b),
    )
    const hilo = suyos[0] ?? SIN_HILO
    const g = grupos.get(hilo) ?? { hilo, issues: [], ultima: 0 }
    g.issues.push(i)
    g.ultima = Math.max(g.ultima, Date.parse(i.fields.updated ?? '') || 0)
    grupos.set(hilo, g)
  }
  return [...grupos.values()].sort((a, b) => b.ultima - a.ultima || a.hilo.localeCompare(b.hilo))
}

/** Una línea de ticket, en el formato que lee `leerTicket` de `parse.ts`. */
export function lineaDe(issue: Issue, hilo: string, yo: string, noHilos: readonly string[]): string {
  const f = issue.fields
  const bloqueado = (f.labels ?? []).some(l => BLOQUEO.test(String(l)))
  const marca = bloqueado ? '🚧' : f.status?.statusCategory?.key === 'indeterminate' ? '▶ ' : '· '
  const otros = hilosDe(issue, noHilos).filter(h => h !== hilo)
  const dueno = f.assignee?.accountId
  const quien =
    dueno === yo ? '' : `  → ${dueno === undefined ? 'sin asignar' : f.assignee?.displayName?.trim() || 'sin nombre'}`
  return (
    `${marca} ${emojiDeTipo(issue)} ${issue.key.padEnd(9)} ${prioridadCorta(f.priority?.name).padEnd(4)} ` +
    `${recortarTexto(f.summary, 58)}${otros.length ? `  +${otros.join(',')}` : ''}${quien}`
  )
}

/** Lo que cuenta el marcador; es el contrato `## Pulso` del README. */
export type PulsoArmado = {
  tramo: string
  abren: number
  cierran: number
  subtareas: number
  tuyos: number
  puesto: number
  personas: number
  pendientes: number
  /** `nombre` es el `displayName` de Jira, y `Tú` el tuyo. */
  carrera: { cerrados: number; abiertos: number; nombre: string }[]
  meta: number
}

/** El `displayName` de cada `accountId`; `|` y saltos fuera, que son el separador. */
function nombresDe(...listas: readonly (readonly Issue[])[]): Map<string, string> {
  const n = new Map<string, string>()
  for (const xs of listas)
    for (const i of xs) {
      const a = i.fields.assignee
      if (a?.accountId && a.displayName && !n.has(a.accountId))
        n.set(a.accountId, a.displayName.replace(/[|\s]+/gu, ' ').trim())
    }
  return n
}

/** Cuántos tickets lleva cada persona, por `accountId`, sin subtareas. */
function porPersona(issues: readonly Issue[]): Map<string, number> {
  const t = new Map<string, number>()
  for (const i of issues) {
    if (esSubtarea(i) !== false) continue
    const id = i.fields.assignee?.accountId
    if (!id) continue
    t.set(id, (t.get(id) ?? 0) + 1)
  }
  return t
}

/**
 * Cuenta el marcador de lo que trajeron las consultas, ya sin épicas.
 *
 * `null` si a algún issue no le llegó el tipo: sin él no se separan las
 * subtareas, y un marcador que no sabe lo que cuenta se pinta igual de
 * convincente que uno bueno. Es la regla del guion de backend, del que sale.
 *
 * Lo tuyo se cuenta por `accountId` y no por nombre: dos personas pueden
 * llamarse igual, y un espacio de más en el nombre te dejaría con 0 cierres.
 */
export function armarPulso(d: {
  creados: readonly Issue[]
  cerrados: readonly Issue[]
  abiertos: readonly Issue[]
  yo: string
  tramo: string
}): PulsoArmado | null {
  const sinSub = (xs: readonly Issue[]) => {
    let n = 0
    for (const x of xs) {
      const s = esSubtarea(x)
      if (s === null) return null
      if (!s) n++
    }
    return n
  }
  const abren = sinSub(d.creados)
  const cierran = sinSub(d.cerrados)
  const abiertosDelTeam = sinSub(d.abiertos)
  if (abren === null || cierran === null || abiertosDelTeam === null) return null
  const cerradosPor = porPersona(d.cerrados)
  const abiertosPor = porPersona(d.abiertos)
  const tuyos = cerradosPor.get(d.yo) ?? 0
  const pendientes = abiertosPor.get(d.yo) ?? 0
  const mejores = [...cerradosPor.values()].filter(n => n > tuyos).length
  const personas = tuyos > 0 ? cerradosPor.size : cerradosPor.size + 1
  const ids = new Set([...cerradosPor.keys(), ...abiertosPor.keys()])
  const nombres = nombresDe(d.cerrados, d.abiertos)
  const carrera = [...ids].map(id => ({
    cerrados: cerradosPor.get(id) ?? 0,
    abiertos: abiertosPor.get(id) ?? 0,
    nombre: id === d.yo ? 'Tú' : (nombres.get(id) ?? '?'),
  }))
  // Sin nada tuyo no estás en ninguna tabla, y sin dorsal no hay animal tuyo.
  if (tuyos === 0 && pendientes === 0) carrera.push({ cerrados: 0, abiertos: 0, nombre: 'Tú' })
  carrera.sort((a, b) => b.cerrados - a.cerrados || a.abiertos - b.abiertos || a.nombre.localeCompare(b.nombre))
  return {
    tramo: d.tramo,
    abren,
    cierran,
    subtareas: d.cerrados.length - cierran,
    tuyos,
    puesto: mejores + 1,
    personas,
    pendientes,
    carrera,
    // Todo el trabajo del Team en el tramo: lo abierto —sin asignar incluido—
    // más lo cerrado. La misma meta para todos (mi-mesa 1.9.0).
    meta: abiertosDelTeam + cierran,
  }
}

/** La sección `## Pulso` tal como la lee `parsePulso`. */
export function seccionDelPulso(p: PulsoArmado, conNombres = false): string[] {
  return [
    '## Pulso de la semana',
    '',
    'Lo que **entra** contra lo que **sale**, de **martes a lunes**, del Team entero y ' +
      (conNombres
        ? 'con los **nombres** de la carrera en `nombres`, en su mismo orden (`Tú` eres tú). '
        : '**sin nombres**. ') +
      'Las subtareas no entran en `abren` ni en `cierran`. `meta` es lo ' +
      'abierto del Team, asignado o no, más lo cerrado en el tramo: la meta común de la carrera.',
    '',
    '```',
    `tramo: ${p.tramo}`,
    `abren: ${p.abren}`,
    `cierran: ${p.cierran}`,
    `subtareas: ${p.subtareas}`,
    `tuyos: ${p.tuyos}`,
    `puesto: ${p.puesto}`,
    `personas: ${p.personas}`,
    `pendientes: ${p.pendientes}`,
    `carrera: ${p.carrera.map(x => `${x.cerrados}/${x.abiertos}`).join(' ')}`,
    ...(conNombres ? [`nombres: ${p.carrera.map(x => x.nombre || '?').join(' | ')}`] : []),
    `meta: ${p.meta}`,
    '```',
    '',
  ]
}

/** Las consultas, todas del mismo censo: el proyecto y, si se dijo, el Team. */
export function consultas(cfg: ConfigJira, campoTeam: number | undefined, desde: string) {
  const team = cfg.team ? ` AND cf[${campoTeam}] = "${cfg.team}"` : ''
  const censo = `project = "${cfg.proyecto}"${team}`
  const abierto = `${censo} AND statusCategory != Done`
  return {
    mios: `${abierto} AND (assignee = currentUser() OR reporter = currentUser()) ORDER BY updated DESC`,
    abiertos: abierto,
    creados: `${censo} AND created >= "${desde}"`,
    cerrados: `${censo} AND statusCategory = Done AND resolutiondate >= "${desde}"`,
  }
}

const CAMPOS_MESA = ['summary', 'labels', 'updated', 'priority', 'status', 'issuetype', 'assignee']
const CAMPOS_PULSO = ['issuetype', 'assignee']

/** Lo que falta o está mal en `/config`, en una frase; `undefined` si vale. */
export function problemaDeConfig(cfg: ConfigJira): string | undefined {
  if (!/^https:\/\/[^\s/]+/u.test(cfg.url)) return 'La URL de Jira tiene que empezar por https://'
  if (!cfg.email) return 'Falta el correo de Jira'
  if (!cfg.token) return 'Falta el token de Jira'
  if (!CLAVE_PROYECTO.test(cfg.proyecto)) return `«${cfg.proyecto}» no es una clave de proyecto (p. ej. ABC)`
  if (cfg.team && !UUID.test(cfg.team))
    return 'El Team va por su UUID, no por su nombre: por nombre Jira contesta 0 resultados sin error'
  return undefined
}

/**
 * Pide a Jira lo que hace falta y devuelve el `docs/MI-MESA.md` entero.
 *
 * Falla —en vez de escribir una mesa vacía— cuando el censo del Team sale a
 * cero: un UUID mal copiado contesta 0 sin error, y una mesa vacía se lee como
 * «has terminado». Si lo que falla es solo el pulso, la mesa sale sin él y lo
 * dice al pie.
 */
export async function generar(cliente: Cliente, cfg: ConfigJira, hoy: Date): Promise<string> {
  const problema = problemaDeConfig(cfg)
  if (problema) throw new Error(problema)
  const yo = await cliente.yo()
  const campo = cfg.team ? await cliente.campoTeam() : undefined
  if (cfg.team && campo === undefined)
    throw new Error('Esta instancia de Jira no tiene campo Team: deja el Team vacío')
  const q = consultas(cfg, campo, inicioDeLaSemana(hoy))
  const [mios, abiertos] = await Promise.all([
    cliente.buscar(q.mios, CAMPOS_MESA),
    cliente.buscar(q.abiertos, CAMPOS_PULSO),
  ])
  if (cfg.team && abiertos.length === 0)
    throw new Error(`El Team ${cfg.team} no tiene ningún abierto en ${cfg.proyecto}: revisa el UUID`)

  const enMesa = mios.filter(i => !esEpica(i))
  const epicas = mios.length - enMesa.length
  const sinAsignar = abiertos.filter(i => !esEpica(i) && !i.fields.assignee?.accountId).length
  const grupos = agrupar(enMesa, cfg.noHilos)

  let pulso: PulsoArmado | null = null
  let sinPulso = ''
  try {
    const [creados, cerrados] = await Promise.all([
      cliente.buscar(q.creados, CAMPOS_PULSO),
      cliente.buscar(q.cerrados, CAMPOS_PULSO),
    ])
    pulso = armarPulso({
      creados: creados.filter(i => !esEpica(i)),
      cerrados: cerrados.filter(i => !esEpica(i)),
      abiertos: abiertos.filter(i => !esEpica(i)),
      yo: yo.accountId,
      tramo: tramoDe(hoy),
    })
    if (pulso === null) sinPulso = 'a algún ticket no le llegó el tipo, y sin él no se separan las subtareas'
  } catch (err) {
    sinPulso = err instanceof Error ? err.message : String(err)
  }

  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`
  const ambito = cfg.team ? `proyecto **${cfg.proyecto}**, Team \`${cfg.team}\`` : `proyecto **${cfg.proyecto}**`
  const out: string[] = [
    '# Mi mesa de trabajo',
    '',
    `> 🤖 **Generado** por \`mi-mesa\` el ${fechaLocal(hoy)}, para **${yo.displayName || 'ti'}**, ${ambito}.`,
    '> **No se versiona** —es por persona— y **no se edita a mano**: lo reescribe la ↻ del panel.',
    '',
    `**${plural(enMesa.length, 'ticket')}** en **${plural(grupos.length, 'hilo')}**: lo abierto que tienes asignado o creaste.`,
    '',
    'Columnas: `▶` ya empezado · `·` sin empezar · `🚧` bloqueado · tipo (`🐞` error · `✅` tarea · ' +
      '`📖` historia · `❔` otro) · clave · prioridad · resumen · `+` otros hilos · `→` quién lo tiene, si no eres tú.',
    '',
  ]
  for (const g of grupos) {
    out.push(`## ${g.hilo} (${g.issues.length})`, '', '```')
    for (const i of g.issues) out.push(lineaDe(i, g.hilo, yo.accountId, cfg.noHilos))
    out.push('```', '')
  }
  if (pulso) out.push(...seccionDelPulso(pulso, cfg.nombres === true))
  out.push(
    '## Lo que NO está aquí',
    '',
    `- **${plural(epicas, 'épica')}** tuya${epicas === 1 ? '' : 's'}: son contenedores, nadie coge una.`,
    `- **${sinAsignar}** abierto${sinAsignar === 1 ? '' : 's'} sin asignar en el ${cfg.team ? 'Team' : 'proyecto'}.`,
    ...(sinPulso ? [`- ⚠️ Sin pulso de la semana: ${sinPulso}.`] : []),
    '',
  )
  return out.join('\n')
}
