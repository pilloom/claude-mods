import type { Dorsal, Hilo, Mesa, Notas, Prompt, Pulso, Ticket } from '../types'

/**
 * Una línea de ticket: la marca de estado y todo lo que viene detrás.
 *
 * Lo de detrás **ya no se parte aquí**. La línea tiene una columna que puede
 * estar o no estar —el tipo del ticket (`🐞`, `✅`, `📖`), que unas mesas
 * escriben y otras todavía no—, y meterla como grupo opcional de este patrón
 * obliga a decir *qué* emojis se aceptan: un tipo nuevo en Jira, con un emoji
 * que esa lista no conociera, dejaría de casar la línea **entera** y el ticket
 * desaparecería del panel. Partiendo por tokens no hay lista cerrada: lo que
 * esté delante de la clave es el tipo, sea lo que sea.
 *
 * La clave va **con el prefijo del proyecto abierto**, no con uno concreto. La
 * primera versión pedía `LAN-\d+`, que es el de `backend_lanzadera`, de donde
 * se portó este mod; en `renovatio` las claves son `REN-` y **no casaba
 * ninguna línea**, así que `parseMesa` devolvía cero hilos —los vacíos se
 * filtran al final— y el panel salía en blanco teniendo la mesa delante, bien
 * generada. El fichero nunca fue el problema: `register.tsx` ya lo busca en la
 * raíz de la sesión.
 *
 * La cola se parte aparte y no con más grupos opcionales aquí: así se lee qué
 * se separa y en qué orden, y un resumen con un `+` dentro no desplaza nada.
 */
const TICKET = /^(▶|·|🚧)\s+(.*)$/u

/**
 * La clave de un ticket, y nada más.
 *
 * Es lo que decide si el primer token de la línea es el tipo o ya es la clave,
 * así que va **anclada por los dos lados**: `LAN-2669algo` no es una clave, y
 * aceptarlo correría una columna entera.
 */
const CLAVE = /^[A-Z][A-Z0-9]*-\d+$/u

/** Arranca el primer token de `s` y devuelve también lo que queda detrás. */
function partirToken(s: string): { token: string; resto: string } | undefined {
  const m = /^(\S+)\s+(.*)$/u.exec(s.trimStart())
  if (!m) return undefined
  return { token: m[1] ?? '', resto: m[2] ?? '' }
}

/**
 * Lee una línea de ticket: `marca [tipo] clave prioridad resumen [+hilos] [→quién]`.
 *
 * El tipo es **opcional** porque cada repositorio tiene su propio guion
 * generador y se portan de uno en uno: la mesa que todavía no escribe esa
 * columna se lee igual que antes, y el panel se limita a no pintar lo que no
 * hay. Es la misma regla que la columna de `→ quién lo tiene`.
 *
 * Una línea que no deja una clave donde toca no es un ticket y se descarta, que
 * es lo que mantiene fuera del panel lo que empieza por `·` sin serlo.
 */
function leerTicket(mark: string, cola: string): Ticket | undefined {
  const primero = partirToken(cola)
  if (!primero) return undefined
  // Lo que esté delante de la clave es el tipo. No se compara contra ninguna
  // lista: el emoji lo elige el guion de cada repositorio, no este fichero.
  const tipo = CLAVE.test(primero.token) ? undefined : primero.token
  const conClave = tipo === undefined ? primero : partirToken(primero.resto)
  if (!conClave || !CLAVE.test(conClave.token)) return undefined
  const conPrioridad = partirToken(conClave.resto)
  if (!conPrioridad) return undefined
  return {
    mark,
    key: conClave.token,
    priority: conPrioridad.token,
    ...partirCola(conPrioridad.resto),
    // `tipo` solo si la mesa lo escribe: la de un repo sin esa columna no gana
    // un campo vacío, y el panel decide por su ausencia que ahí no pinta nada
    // en vez de dejar un hueco.
    ...(tipo === undefined ? {} : { tipo }),
  }
}

/**
 * Quién lo tiene, si no eres tú: `→ sin asignar`, `→ Nombre`.
 *
 * Es una columna que no existía en la mesa de la que salió este mod y que la de
 * `renovatio` sí escribe. Sin separarla acababa pegada al resumen, que es lo
 * que el panel recorta: el nombre se comía el final del título.
 */
const OWNER = /\s+→\s*(.+)$/u

/** Los otros hilos a los que pertenece, que el fichero marca con `+`. */
const THREADS = /\s+(\+\S.*)$/u

/** Separa de la cola de la línea lo que no es el resumen. */
function partirCola(cola: string): { summary: string; otherThreads: string; owner?: string } {
  let resto = cola
  const owner = OWNER.exec(resto)?.[1]
  if (owner !== undefined) resto = resto.replace(OWNER, '')
  const otherThreads = THREADS.exec(resto)?.[1] ?? ''
  if (otherThreads) resto = resto.replace(THREADS, '')
  // `owner` solo si lo hay: la mesa de un repo sin esa columna no gana un campo.
  return { summary: resto.trim(), otherThreads, ...(owner === undefined ? {} : { owner }) }
}

/**
 * El guion que escribió la mesa, tal como la cabecera del fichero lo nombra.
 *
 * El fichero generado se autodeclara —«**Generado** por `scripts/qa/listar-mi-mesa.js`
 * el …»—, y de ahí sale el comando del botón de regenerar sin pedirle a nadie
 * que configure nada: cada repositorio nombra el suyo, que es el `.js` en los
 * de Node y el `.dart` en los de Flutter.
 *
 * Es texto de un fichero versionado, así que lo que se lee aquí **no** se
 * ejecuta sin más: `comandoDe` decide qué se acepta.
 */
const GUION = /generado\*\* por `([^`\n]+)`/i

/**
 * Los intérpretes que el botón de regenerar acepta, por extensión.
 *
 * La lista es cerrada a propósito: es lo que convierte una ruta leída de un
 * fichero del repositorio en un comando acotado. Lo que no esté aquí no se
 * ejecuta, aunque la cabecera lo nombre.
 */
const INTERPRETES: Record<string, string[]> = {
  '.js': ['node'],
  '.mjs': ['node'],
  '.cjs': ['node'],
  '.dart': ['dart', 'run'],
}

/** Los sitios donde se busca el guion cuando no hay cabecera que lo diga. */
export const GUIONES = ['scripts/qa/listar-mi-mesa.js', 'tool/listar_mi_mesa.dart']

/**
 * El comando que regenera la mesa, a partir de la ruta de su guion.
 *
 * Devuelve el `argv` de `$.process.run` —sin shell— o nada si la ruta no es de
 * las que se aceptan. Lo que se exige, y por qué: **relativa** y sin `..`,
 * porque una ruta absoluta apunta a cualquier sitio de la máquina y esto sale
 * de un fichero que cualquiera puede commitear; solo letras, dígitos, puntos,
 * barras y guiones, que es lo que puede ser el nombre de un guion; y una
 * extensión de `INTERPRETES`, que es quien decide con qué se ejecuta. Así lo
 * peor que puede pasar al pulsar el botón es que corra un guion del propio
 * repositorio, que es el que ya se corre a mano.
 *
 * No comprueba que exista: eso es del disco y lo hace quien llama.
 */
export function comandoDe(ruta: string): string[] | undefined {
  const limpia = ruta.trim()
  // El tope es contra una cabecera absurda, no contra una ruta larga de verdad.
  if (!limpia || limpia.length > 200) return undefined
  if (!/^[\w./-]+$/u.test(limpia)) return undefined
  // Un tramo vacío es la barra de delante, la del final o una doble.
  if (limpia.split('/').some(tramo => tramo === '' || tramo === '..')) return undefined
  const ext = /\.[a-z]+$/u.exec(limpia)?.[0]
  const interprete = ext === undefined ? undefined : INTERPRETES[ext]
  return interprete === undefined ? undefined : [...interprete, limpia]
}

/**
 * Lee del Markdown generado por listar-mi-mesa.js solo los tickets, en el
 * orden y el hilo en que salen. Se para en «Lo que NO está aquí», que no es
 * la mesa sino lo que se queda fuera.
 */
export function parseMesa(text: string, mtimeMs: number): Omit<Mesa, 'repo'> {
  const generated = /generado\*\* por .*? el (\d{4}-\d{2}-\d{2})/i.exec(text)?.[1] ?? '?'
  const generador = GUION.exec(text)?.[1]
  const hilos: Hilo[] = []
  let current: Hilo | undefined
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (line.startsWith('## ')) {
      if (/^## Lo que NO est/.test(line)) break
      current = { title: line.slice(3), tickets: [] }
      hilos.push(current)
      continue
    }
    const m = TICKET.exec(line)
    if (m && current) {
      const ticket = leerTicket(m[1] ?? '', m[2] ?? '')
      if (ticket) current.tickets.push(ticket)
    }
  }
  // `generador` y `pulso`, solo si el fichero los trae: una mesa sin ellos no
  // gana un campo vacío, y quien resuelve el guion o pinta el marcador sabe
  // que ahí no hay nada que mirar. La sección del pulso no estorba a los
  // hilos: no lleva líneas de ticket, así que entra y sale como un hilo vacío
  // y el filtro de abajo la quita de la cuenta.
  const pulso = parsePulso(text)
  // El motivo de que no haya pulso, que el generador del mod deja al pie: en
  // el fichero no lo leía nadie, y el panel solo enseñaba que faltaba.
  const sinPulso = pulso === undefined ? SIN_PULSO.exec(text)?.[1]?.trim() : undefined
  return {
    generated,
    hilos: hilos.filter(h => h.tickets.length > 0),
    mtimeMs,
    ...(generador === undefined ? {} : { generador }),
    ...(pulso === undefined ? {} : { pulso }),
    ...(sinPulso ? { sinPulso } : {}),
  }
}

/** La línea con la que el generador del mod dice por qué no hay pulso. */
const SIN_PULSO = /^- ⚠️ Sin pulso de la semana: (.+?)\.?$/mu

/**
 * Los mensajes que escribiste en este repo, del más nuevo al más viejo.
 *
 * La fuente es `~/.claude/history.jsonl`, que es donde el host apunta lo que se
 * teclea en el prompt: una línea JSON por mensaje, con `display`, `timestamp` y
 * el `project` desde el que se mandó. Se lee de ahí y no de los mensajes de la
 * sesión porque un `/clear` vacía la conversación y no el historial: el panel
 * sigue enseñando lo último que pasaste aunque acabes de limpiar el contexto.
 *
 * `project` se compara contra la raíz de la sesión —y no se acepta cualquier
 * ruta que empiece igual— porque los cuatro repos son hermanos: `lanzadera` es
 * prefijo de `lanzadera_driver`, y filtrar por prefijo mezclaría sus mensajes.
 *
 * Las barras (`/clear`, `/continuar`) se quedan fuera: son órdenes al host, no
 * mensajes al modelo, y llenaban el tercio de abajo de ruido repetido.
 */
export function parseHistory(text: string, project: string, limit: number): Prompt[] {
  const out: Prompt[] = []
  // De atrás hacia delante: el fichero va en orden y lo que se quiere es la cola.
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = (lines[i] ?? '').trim()
    if (!line.startsWith('{')) continue
    let row: { display?: unknown; timestamp?: unknown; project?: unknown }
    try {
      row = JSON.parse(line) as typeof row
    } catch {
      // Una línea a medias (el host escribiendo mientras se lee) no tira el resto.
      continue
    }
    if (row.project !== project) continue
    const display = typeof row.display === 'string' ? row.display.trim() : ''
    if (!display || display.startsWith('/')) continue
    out.push({ text: display.replace(/\s+/gu, ' '), at: typeof row.timestamp === 'number' ? row.timestamp : 0 })
  }
  return out
}

/** Cabeceras y adornos que el post-it no pinta: el rótulo ya lo pone el panel. */
const ADORNO = /^(#{1,6}\s|[-=*_]{3,}\s*$|>\s?)/u

/**
 * La viñeta de una lista de Markdown, que se cambia por una sola.
 *
 * Incluye la `•` que el panel ya pinta, porque también entra por el otro lado:
 * quien dicta una nota puede repetir la viñeta que está viendo, y entonces la
 * línea se guardaría con dos.
 */
const VINETA = /^\s*(?:[-*+•]|\d+[.)])\s+/u

/**
 * Lee NOTAS.md como un post-it: las líneas que hay, en su orden y sin adornos.
 *
 * Es un fichero que escribes a mano y que no sale del clon, así que no tiene
 * formato pactado como la mesa: aquí no se busca ninguna estructura, solo
 * se quitan las cabeceras, las rayas y las citas —el rótulo del panel ya dice
 * que son notas—, se unifican las viñetas en una sola y se tiran las líneas en
 * blanco, que en tres filas de panel no se pagan.
 *
 * Un fichero que existe pero no deja ninguna línea cuenta como no tener notas:
 * la sección desaparece en vez de dejar un hueco con el rótulo solo.
 */
export function parseNotas(text: string, mtimeMs: number): Notas {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || ADORNO.test(line)) continue
    lines.push(line.replace(VINETA, '• '))
  }
  return { lines, mtimeMs }
}

/**
 * Parte una nota en las filas que ocupa a ese ancho, sin cortar palabras.
 *
 * El post-it enseña la nota **entera**: antes se recortaba a una fila con un
 * `…` al final, y una nota de dos renglones —que es la nota normal— había que
 * ir a leerla al fichero, que es justo lo que el panel viene a ahorrar. Una
 * nota corta sigue siendo una fila y no cambia nada.
 *
 * Las filas siguientes van sangradas bajo el texto y no bajo la viñeta: así se
 * ve de un vistazo dónde empieza cada nota y dónde continúa la de arriba. Una
 * palabra más larga que la fila —un enlace, una ruta— se parte por donde toque,
 * porque la alternativa es dejar la fila en blanco y salirse igual.
 *
 * El ancho se cuenta en caracteres, como el recorte de la mesa: un emoji ocupa
 * dos columnas en el terminal y aquí cuenta uno, así que una nota con emojis se
 * queda algo corta. Eso es preferible a pasarse de ancho y envolver dos veces.
 */
export function envolver(linea: string, width: number): string[] {
  const ancho = Math.max(10, width)
  // La viñeta sale del texto y pasa a ser el margen de la primera fila. Si se
  // deja dentro, el espacio que lleva detrás es el último hueco de la fila
  // para una nota que empieza por una palabra larga —un enlace— y la primera
  // fila sale con la viñeta sola.
  const vineta = linea.startsWith('• ') ? '• ' : ''
  const sangria = vineta ? '  ' : ''
  const filas: string[] = []
  let resto = linea.slice(vineta.length)
  while (resto.length > 0) {
    const prefijo = filas.length === 0 ? vineta : sangria
    const hueco = ancho - prefijo.length
    if (resto.length <= hueco) {
      filas.push(prefijo + resto)
      break
    }
    const espacio = resto.lastIndexOf(' ', hueco)
    const corte = espacio > 0 ? espacio : hueco
    filas.push((prefijo + resto.slice(0, corte)).trimEnd())
    resto = resto.slice(corte).trimStart()
  }
  return filas.length > 0 ? filas : [linea]
}

/**
 * Dónde está en el fichero cada nota que el post-it pinta, en el mismo orden.
 *
 * Es el filtro de `parseNotas` visto por el otro lado: las líneas que el panel
 * enseña son estas, así que la nota número `n` del panel es la de `pos[n]`. De
 * ahí sale el poder quitarla por su número y no buscándola por el texto.
 */
function posiciones(lines: string[]): number[] {
  const pos: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (!line || ADORNO.test(line)) continue
    pos.push(i)
  }
  return pos
}

/** El mismo texto sin tildes ni mayúsculas, para buscar como se busca a mano. */
function plano(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Devuelve el fichero con una nota más al final.
 *
 * Añade, no reescribe: NOTAS.md lo escribe una persona y puede tener lo que
 * quiera dentro —párrafos, secciones, lo que sea—, así que lo único que se
 * toca es el final. Un fichero que no existe todavía nace con su cabecera.
 *
 * La viñeta se pone aquí y se quita de lo que llegue: quien dicta la nota
 * mirando el panel repite la `•` que está viendo, y la línea acabaría con dos.
 */
export function anadirNota(text: string, nota: string): string {
  const limpia = nota.trim().replace(/\s+/gu, ' ').replace(VINETA, '')
  if (!limpia) return text
  const base = text.trimEnd()
  return base ? `${base}\n- ${limpia}\n` : `# Notas\n\n- ${limpia}\n`
}

/** Lo que deja un intento de quitar una nota: el fichero y a qué casó. */
export type Quitada = {
  /** El fichero resultante; el mismo de entrada si no se quitó nada. */
  texto: string
  /** La nota que se quitó, solo si casó exactamente una. */
  quitada?: string
  /** Todas las que casaron, para poder decir por qué no se quitó ninguna. */
  candidatas: string[]
}

/**
 * Quita **una** nota, la que case con `patron`, y solo si no hay duda.
 *
 * Con cero o con más de una casando no se toca el fichero: se devuelven las
 * candidatas para que quien llame lo diga. Borrar la nota equivocada es peor
 * que no borrar ninguna, y acertando a medias no hay manera de saber cuál
 * querías. Se busca sin tildes y sin mayúsculas, como se busca a mano.
 */
export function quitarNota(text: string, patron: string): Quitada {
  const aguja = plano(patron.trim())
  const lines = text.split('\n')
  const indices = posiciones(lines).filter(i => aguja && plano(lines[i] ?? '').includes(aguja))
  const candidatas = indices.map(i => (lines[i] ?? '').trim().replace(VINETA, ''))
  const unica = indices.length === 1 ? indices[0] : undefined
  if (unica === undefined) return { texto: text, candidatas }
  return {
    texto: lines.filter((_, j) => j !== unica).join('\n'),
    quitada: candidatas[0],
    candidatas,
  }
}

/**
 * Quita la nota que hace el número `n` del post-it, contando desde arriba.
 *
 * Es lo que pulsa la equis del panel, y por eso no busca ni pregunta: ahí no
 * hay duda que resolver, se está señalando una nota concreta con el dedo. Dos
 * notas iguales —que `quitarNota` se niega a tocar, y con razón— aquí se
 * quitan sin problema, porque se sabe cuál de las dos.
 *
 * `esperada` es lo que el panel tenía pintado en ese sitio. Si el fichero
 * cambió por debajo —a mano, desde otra sesión, desde otra rama— la nota
 * número `n` ya no es la misma y no se quita nada: el panel se relee y enseña
 * lo que hay. Borrar la de al lado por un redibujado tarde es justo lo que no
 * puede pasar.
 */
export function quitarNotaN(text: string, n: number, esperada: string): Quitada {
  const lines = text.split('\n')
  const pos = posiciones(lines)[n]
  if (pos === undefined) return { texto: text, candidatas: [] }
  const actual = (lines[pos] ?? '').trim().replace(VINETA, '')
  if (actual !== esperada.trim().replace(VINETA, '')) return { texto: text, candidatas: [] }
  return {
    texto: lines.filter((_, j) => j !== pos).join('\n'),
    quitada: actual,
    candidatas: [actual],
  }
}

/**
 * El rótulo de la sección del pulso, que es lo que acota su bloque.
 *
 * Las cifras se leen **solo ahí dentro** y no en todo el fichero: un `tuyos: 3`
 * suelto en la prosa de cualquier otra sección no es el marcador, y leer por
 * clave sin acotar convertiría cualquier frase en un dato.
 */
const PULSO_H = /^##\s+pulso/iu

/** Cualquier otra sección: donde acaba la del pulso. */
const SECCION = /^##\s/u

/** Una cifra del pulso: `clave: entero`. */
const CIFRA = /^\s*([a-z]+)\s*:\s*(-?\d+)\s*$/iu

/** El tramo, que es la única que no es un número: `tramo: MAR-LUN`. */
const TRAMO = /^\s*tramo\s*:\s*([\w-]{1,12})\s*$/iu

/**
 * Un dorsal por persona, sin nombres: `carrera: 16/75 9/1 4/36` —cerrados y
 * abiertos— o, en los guiones de la 1.7, solo los cerrados: `carrera: 21 18 3`.
 */
const CARRERA = /^\s*carrera\s*:\s*(\d+(?:\/\d+)?(?:[\s,]+\d+(?:\/\d+)?)*)\s*$/iu

/**
 * Los nombres de la carrera (desde la 1.11.0), en el orden de `carrera` y
 * separados por `|`: `nombres: Tú | Miguel Ángel Canto | Allison González`.
 * `Tú` marca tu dorsal. Si la cuenta no cuadra con `carrera`, no se lee.
 */
const NOMBRES = /^\s*nombres\s*:\s*(.+?)\s*$/iu

/**
 * Lee el marcador de la semana de la sección `## Pulso` de la mesa.
 *
 * Devuelve nada si no está la sección o si falta una de las dos cifras que
 * sostienen el marcador: sin `abren` y `cierran` no hay nada que comparar, y
 * media línea —«cierran 88» sola— no contesta la pregunta que motiva, que es
 * si se cierra más de lo que entra. Una mesa cuyo guion todavía no escriba la
 * sección se pinta como siempre, sin hueco; es la regla de todas las columnas
 * que se han ido portando de un repositorio a otro.
 *
 * Las cifras negativas se descartan en lugar de pintarse: un `abren: -3` es un
 * guion roto, y un marcador que enseña un dato imposible se cree.
 */
export function parsePulso(text: string): Pulso | undefined {
  let dentro = false
  const n = new Map<string, number>()
  let tramo: string | undefined
  let carrera: Dorsal[] | undefined
  let nombres: string[] | undefined
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (PULSO_H.test(line)) {
      dentro = true
      continue
    }
    if (dentro && SECCION.test(line)) break
    if (!dentro) continue
    // 🔴 La carrera antes que las cifras: `carrera: 16` —un Team de una sola
    // persona— también casa con `CIFRA`, y leída ahí se guardaba como una cifra
    // más y la carrera se perdía. Con dos o más cifras no pasaba, que es por lo
    // que no lo vio ningún test.
    const c = CARRERA.exec(line)
    if (c) {
      carrera = (c[1] ?? '').split(/[\s,]+/u).map(t => {
        const [cerrados = 0, abiertos] = t.split('/').map(Number)
        return abiertos === undefined ? { cerrados } : { cerrados, abiertos }
      })
      continue
    }
    const ns = NOMBRES.exec(line)
    if (ns) {
      nombres = (ns[1] ?? '').split('|').map(s => s.trim())
      continue
    }
    const cifra = CIFRA.exec(line)
    if (cifra) {
      n.set((cifra[1] ?? '').toLowerCase(), Number(cifra[2]))
      continue
    }
    const t = TRAMO.exec(line)
    if (t) tramo = t[1]
  }
  const abren = n.get('abren')
  const cierran = n.get('cierran')
  if (abren === undefined || cierran === undefined || abren < 0 || cierran < 0) return undefined
  /** Las de detrás son opcionales, y una imposible se deja fuera, no se pinta. */
  const si = (k: string, min: number): number | undefined => {
    const v = n.get(k)
    return v === undefined || v < min ? undefined : v
  }
  const subtareas = si('subtareas', 0)
  const tuyos = si('tuyos', 0)
  const puesto = si('puesto', 1)
  const personas = si('personas', 1)
  const pendientes = si('pendientes', 0)
  const meta = si('meta', 1)
  // Los nombres van con su dorsal o no van: si no cuadran, cualquiera de ellos
  // podría ser de otra persona, y un nombre en el sitio de otro es peor que ninguno.
  if (carrera && nombres?.length === carrera.length && nombres.every(Boolean))
    carrera = carrera.map((d, i) => ({ ...d, nombre: nombres[i] ?? '' }))
  return {
    abren,
    cierran,
    ...(subtareas === undefined ? {} : { subtareas }),
    ...(tuyos === undefined ? {} : { tuyos }),
    ...(puesto === undefined ? {} : { puesto }),
    ...(personas === undefined ? {} : { personas }),
    ...(pendientes === undefined ? {} : { pendientes }),
    ...(meta === undefined ? {} : { meta }),
    ...(tramo === undefined ? {} : { tramo }),
    ...(carrera === undefined ? {} : { carrera }),
  }
}

/** Un trozo de una fila de la carrera; `tu` lo que va en negritas. */
export type Tramo = { text: string; tu?: boolean }

/** Las tres filas de la carrera, de arriba abajo. */
export type Carrera = { cifras: Tramo[]; flechas: Tramo[]; pista: string }

/** La meta y la salida, en los extremos de la pista. */
const META = '🏁'
const SALIDA = '🚦'

/** Las palabras de un nombre que no dan inicial: «María de la Cruz» es MC. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'das', 'do', 'dos', 'van', 'von'])

/** ¿Es tu dorsal? El guion lo marca con `Tú` en `nombres`. */
export function esTuNombre(nombre: string | undefined): boolean {
  return nombre !== undefined && /^t[uú]$/iu.test(nombre.trim())
}

/**
 * Las iniciales con las que cada nombre corre en la pista (desde la 1.11.0):
 * la de sus **dos primeras palabras**, sin acentos —«Miguel Ángel Canto Poot»
 * es `MA`—, y con un nombre de una palabra, sus dos primeras letras.
 *
 * Solo si dos coinciden se alargan, y solo esas: con la inicial de la palabra
 * siguiente —`AML`, `AMG`— y, si ni así, con un número —`AM`, `AM2`—. Un
 * nombre sin letras se queda en `''` y corre solo con su cifra.
 */
export function inicialesDe(nombres: readonly string[]): string[] {
  const palabras = nombres.map(n =>
    n
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/\s+/u)
      .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(w => w.length > 0 && !PARTICULAS.has(w.toLowerCase())),
  )
  const con = (p: readonly string[], k: number): string =>
    (p.length === 1 ? (p[0] ?? '').slice(0, k) : p.slice(0, k).map(w => w[0] ?? '').join('')).toUpperCase()
  const out = palabras.map(p => con(p, 2))
  const repetidas = () => {
    const n = new Map<string, number>()
    for (const s of out) if (s) n.set(s, (n.get(s) ?? 0) + 1)
    return out.map(s => s !== '' && (n.get(s) ?? 0) > 1)
  }
  const largo = Math.max(2, ...palabras.map(p => p.length))
  for (let k = 3; k <= largo; k++) {
    const rep = repetidas()
    if (!rep.some(Boolean)) break
    palabras.forEach((p, i) => {
      if (rep[i]) out[i] = con(p, k)
    })
  }
  const vistas = new Map<string, number>()
  return out.map(s => {
    if (!s) return s
    const n = (vistas.get(s) ?? 0) + 1
    vistas.set(s, n)
    return n === 1 ? s : `${s}${n}`
  })
}

/** Lo menos que tiene que medir la pista para que la carrera diga algo. */
const PISTA_MIN = 20

/**
 * La carrera de la semana: una sola pista, con la meta a la izquierda y la
 * salida a la derecha, y en ella un animal por cifra con su flecha y su número
 * encima. Devuelve nada cuando no hay con qué pintarla.
 *
 * 🔑 **La pista va al revés —meta a la izquierda— por los emojis**: 🐇 y 🐢
 * miran a la izquierda en la fuente de emojis de macOS, y un terminal no puede
 * voltear un glifo. Así corren hacia donde miran.
 *
 * Cómo se reparte:
 * - Cada animal a la distancia de la meta que le toca **según lo que cerró
 *   contra el trabajo del Team** (`meta`): la misma meta para todos, así que
 *   va delante quien más cerró. Sin `meta`, contra su propia mesa —cerrados más
 *   abiertos—, y si tampoco hay abiertos, en proporción al líder.
 * - Encima va la cifra de **cerrados**; el avance lo dice la posición. La
 *   liebre es de quien va más avanzado, y de todos los que empaten ahí.
 * - **Tú vas donde te toca, siempre.** Quien te pisa se aparta: los que van
 *   detrás de ti —y los que empatan contigo, como el empate con la banca—
 *   **retroceden** hacia la salida, y los que van delante se apartan **hacia la
 *   meta**, porque retrocederlos los pondría detrás de ti con más cierres.
 * - Los demás que empatan entre sí son **una sola tortuga**, con `7×2`.
 * - Pegada a la salida, tu etiqueta crece hacia la meta y se lee `(Tú) 0`,
 *   para que la flecha siga cayendo debajo de la cifra.
 * - Si al apartarse alguien no cabe, pierde su cifra y su flecha antes que
 *   pisar la tuya; su animal se queda en su sitio si está libre.
 *
 * - **Con nombres** (desde la 1.11.0, `conNombres`, que es «Carrera con
 *   nombres» en `/config`): si los dorsales los traen, cada cifra va con las
 *   iniciales de quien corre —`MA 6`— y un empate con las de todos —`AA·WS 0`—.
 *   Apagado, o sin nombres en la mesa, la pista es la de siempre.
 *
 * No pasa de `width - 1` columnas, contando los emojis a dos.
 */
export function carreraDe(
  dorsales: readonly Dorsal[],
  yo: Dorsal,
  width: number,
  meta?: number,
  conNombres = false,
): Carrera | undefined {
  const W = width - 1
  const T = W - anchoEnTerminal(META) - anchoEnTerminal(SALIDA)
  if (T < PISTA_MIN || dorsales.length === 0 || yo.cerrados < 0) return undefined
  // Sin un solo cierre no hay carrera: todos en la salida no dicen nada.
  const mx = Math.max(...dorsales.map(d => d.cerrados), yo.cerrados)
  if (mx <= 0) return undefined
  /**
   * 🔑 **La meta es vaciar tu mesa** cuando el guion escribe los abiertos de
   * cada uno: el avance es lo cerrado contra todo lo que tenías —cerrado más
   * abierto—, así que solo llega quien deja su mesa vacía. Con la meta en el
   * líder, quien corría solo llegaba siempre, aunque le quedaran 75 abiertos.
   * Sin los abiertos —guiones de la 1.7— la meta sigue siendo el líder.
   *
   * 🔑 **Desde la 1.9.0 la meta es del Team** cuando el guion escribe `meta`:
   * todo lo que el Team tenía que hacer en el tramo —lo pendiente, sin asignar
   * incluido, más lo cerrado—. Contra la mesa de cada uno no era parejo: quien
   * tenía 1 abierto y cerró 1 iba al 50 % y se llevaba la liebre, por delante
   * de quien cerró 15 con 33 abiertos. Con una sola meta, delante va quien más
   * cerró, y nadie la pasa: un guion que se queda corto se recorta al 100 %.
   */
  const deTeam = meta !== undefined && meta > 0
  const conAbiertos = yo.abiertos !== undefined && dorsales.every(d => d.abiertos !== undefined)
  const deMesa = !deTeam && conAbiertos
  const avance = (d: Dorsal): number => {
    if (deTeam) return Math.min(1, d.cerrados / meta)
    if (!deMesa) return d.cerrados / mx
    const total = d.cerrados + (d.abiertos ?? 0)
    return total === 0 ? 0 : d.cerrados / total
  }
  const ultimo = T - 2
  const ideal = (p: number) => Math.round((1 - p) * ultimo)
  // Tu dorsal se busca con sus abiertos siempre que los haya, también con la
  // meta del Team: es lo que te distingue de otra persona con tus cierres.
  const mismo = (a: Dorsal, b: Dorsal) => a.cerrados === b.cerrados && (!conAbiertos || a.abiertos === b.abiertos)

  /** `corto`: la etiqueta sin iniciales, para cuando con ellas no cabe. */
  type Corredor = { c: number; p: number; tu: boolean; x: number; lab: string; corto: string; cifra: boolean }
  const resto = new Map<string, { d: Dorsal; n: number; quienes: string[] }>()
  // Con `Tú` en los nombres tu dorsal se sabe seguro; sin él, se busca por cifras.
  const marcado = dorsales.findIndex(d => esTuNombre(d.nombre))
  const nombrados = conNombres && dorsales.every(d => d.nombre !== undefined)
  const ajenos = dorsales.filter((_, i) => i !== marcado).map(d => d.nombre ?? '')
  const iniciales = new Map<Dorsal, string>()
  if (nombrados) {
    const inis = inicialesDe(ajenos)
    dorsales.filter((_, i) => i !== marcado).forEach((d, i) => iniciales.set(d, inis[i] ?? ''))
  }
  let quitado = false
  for (const [i, d] of dorsales.entries()) {
    // Uno de los dorsales iguales al tuyo eres tú; si el guion no te puso, se
    // te añade igual: tu dorsal ya lo dicen `tuyos` y `pendientes`.
    if (marcado >= 0 ? i === marcado : !quitado && mismo(d, yo)) {
      quitado = true
      continue
    }
    // Se agrupa por lo que se PINTA —la cifra y el sitio—, no por el dorsal
    // entero: `0/1` y `0/50` están los dos al 0 %, con la misma cifra encima, y
    // como dos corredores el segundo no cabía en la salida y desaparecía de la
    // pista. Juntos son una tortuga con `0×2`, como cualquier otro empate.
    const k = deMesa ? `${d.cerrados}@${avance(d)}` : String(d.cerrados)
    const prev = resto.get(k)
    const quien = iniciales.get(d)
    resto.set(k, { d, n: (prev?.n ?? 0) + 1, quienes: [...(prev?.quienes ?? []), ...(quien ? [quien] : [])] })
  }
  const pYo = avance(yo)
  const tuLab = `${yo.cerrados} (Tú)`
  const tu: Corredor = { c: yo.cerrados, p: pYo, tu: true, x: ideal(pYo), lab: tuLab, corto: tuLab, cifra: true }
  const otros: Corredor[] = [...resto.values()].map(({ d, n, quienes }) => ({
    corto: n > 1 ? `${d.cerrados}×${n}` : String(d.cerrados),
    c: d.cerrados,
    p: avance(d),
    tu: false,
    x: ideal(avance(d)),
    // Con nombres, quién corre en vez de cuántos: `MA 6`, `AA·WS 0`. Si a
    // alguno del empate le faltan las iniciales, vuelve el `×n`.
    lab:
      nombrados && quienes.length === n
        ? `${quienes.join('·')} ${d.cerrados}`
        : n > 1
          ? `${d.cerrados}×${n}`
          : String(d.cerrados),
    cifra: true,
  }))
  const pMax = Math.max(pYo, ...otros.map(o => o.p))

  /** Dónde empieza la etiqueta, en columnas desde el borde izquierdo. */
  const inicio = (r: Corredor): number => {
    const x = 2 + r.x
    if (x + r.lab.length <= W) return x
    // Pegada a la salida: crece hacia la meta y la cifra queda sobre la flecha.
    if (r.tu) r.lab = `(Tú) ${r.c}`
    return Math.min(x, W - r.lab.length)
  }
  /** Lo que ocupa en la fila de cifras y en la pista: `[desde, hasta)`. */
  const tramo = (r: Corredor): [number, number] => {
    const i = inicio(r)
    const desde = Math.min(i, 2 + r.x)
    return [desde, Math.max(i + r.lab.length, 2 + r.x + 2)]
  }

  // 🔴 Al apartarse nadie puede quitarle el sitio en la pista a los que vienen
  // después: cada uno deja hueco —dos columnas por animal— para los que le
  // quedan detrás, y quien pierde la cifra se queda pegado al anterior, no en
  // su sitio ideal, que ya puede estar ocupado. Con la meta del Team casi todos
  // van cerca de la salida, y sin esto el que retrocedía para enseñar su cifra
  // se sentaba encima de los que iban detrás, que desaparecían de la pista.

  // Detrás de ti, y los que empatan contigo: hacia la salida.
  const detras = otros.filter(o => o.p <= pYo).sort((a, b) => b.p - a.p)
  let fin = tramo(tu)[1]
  let suelo = tu.x + 2
  detras.forEach((r, i) => {
    const tope = ultimo - 2 * (detras.length - 1 - i)
    const base = Math.max(r.x, suelo)
    const cabe = () => {
      r.x = Math.max(base, fin + 1 - 2)
      return r.x <= tope && tramo(r)[0] > fin
    }
    // Con iniciales que no caben, la cifra sola antes que nada: `0×2`.
    if (cabe() || (r.lab !== r.corto && ((r.lab = r.corto), cabe()))) fin = tramo(r)[1]
    else {
      r.cifra = false
      r.x = Math.min(base, tope)
    }
    suelo = r.x + 2
  })
  // Delante de ti: hacia la meta.
  const delante = otros.filter(o => o.p > pYo).sort((a, b) => a.p - b.p)
  let ini = tramo(tu)[0]
  let techo = tu.x - 2
  delante.forEach((r, i) => {
    const piso = 2 * (delante.length - 1 - i)
    const base = Math.min(r.x, techo)
    const cabe = () => {
      r.x = Math.min(base, ini - 1 - Math.max(r.lab.length, 2) - 2)
      return r.x >= piso && tramo(r)[1] < ini
    }
    if (cabe() || (r.lab !== r.corto && ((r.lab = r.corto), cabe()))) ini = tramo(r)[0]
    else {
      r.cifra = false
      r.x = Math.max(base, piso)
    }
    techo = r.x - 2
  })

  const pista: string[] = Array.from({ length: T }, () => '─')
  const tomadas = new Set<number>()
  const fila: (Tramo | undefined)[] = Array.from({ length: W }, () => undefined)
  const flechas: (Tramo | undefined)[] = Array.from({ length: W }, () => undefined)
  // Tú primero, para que nada pise lo tuyo.
  for (const r of [tu, ...otros]) {
    const x = Math.max(0, Math.min(r.x, ultimo))
    if (tomadas.has(x) || tomadas.has(x + 1)) continue
    tomadas.add(x)
    tomadas.add(x + 1)
    // Quien corre solo no va «en cabeza» de nadie: la liebre solo es suya si
    // vació la mesa. Si no, una liebre a un 18 % del camino diría que va bien.
    const liebre = r.p === pMax && (otros.length > 0 || r.p >= 1)
    pista[x] = liebre ? '🐇' : '🐢'
    pista[x + 1] = ''
    if (!r.cifra) continue
    const i = inicio(r)
    for (let k = 0; k < r.lab.length; k++) {
      const ch = r.lab[k]
      if (ch !== undefined && i + k < W) fila[i + k] = { text: ch, tu: r.tu }
    }
    flechas[2 + x] = { text: '▼', tu: r.tu }
  }
  return { cifras: juntar(fila), flechas: juntar(flechas), pista: `${META}${pista.join('')}${SALIDA}` }
}

/** Junta las celdas en trozos del mismo peso, sin espacios colgando al final. */
function juntar(celdas: readonly (Tramo | undefined)[]): Tramo[] {
  const out: Tramo[] = []
  for (const c of celdas) {
    const t = c ?? { text: ' ' }
    const prev = out[out.length - 1]
    if (prev && !!prev.tu === !!t.tu) prev.text += t.text
    else out.push(t.tu ? { text: t.text, tu: true } : { text: t.text })
  }
  const last = out[out.length - 1]
  if (last) last.text = last.text.trimEnd()
  return out.filter(t => t.text.length > 0)
}

/** Un trozo de la línea del marcador, con el papel que hace en ella. */
export type Trozo = {
  text: string
  /**
   * Qué es, para que el panel le ponga su color sin saber de qué habla: el
   * rótulo y los separadores van sin color, el `+` de lo que entra en ámbar, el
   * `-` de lo que se termina en verde, y la flecha del neto en el color de su
   * sentido. `tu` va sin color porque es lo único de la línea que habla de ti.
   *
   * El color no es decoración aquí: es lo que distingue una cifra de otra, que
   * es por lo que la fila entera va en negritas y el peso no significa nada.
   */
  tono: 'rotulo' | 'sep' | 'abren' | 'cierran' | 'gana' | 'pierde' | 'tu'
}

/**
 * Las columnas que ocupa el texto en el terminal, no sus caracteres.
 *
 * Los glifos del marcador —`+`, `✓`, `▲`, `▼`, `▏`— son todos de **una**
 * columna en la tabla de anchos, así que hoy esta cuenta no corrige nada. Sigue
 * aquí porque el día que alguien meta un emoji en la línea la corregirá: un
 * `✅` es un carácter para JavaScript y **dos celdas** en el terminal, y una
 * fila que se pasa de ancho envuelve y descuadra la ventana de la mesa entera
 * —el reparto cuenta una fila por ticket—, que es el fallo que ya costó la
 * columna del tipo.
 *
 * 🔴 **Y por eso el marcador no lleva `✔️`**, que es la palomita que se pediría
 * primero: son dos caracteres —`✔` más un selector de variación invisible— y el
 * selector **no** cambia la tabla, solo le pide al que pinta que lo dibuje como
 * emoji de color. Resultado: esta cuenta dice 1, el motor que monta la fila
 * dice 1 y el terminal pinta 2. Una columna de desacuerdo que no se puede
 * arreglar desde aquí, porque quien rellena y recorta la fila es el motor. El
 * `✅` (U+2705) no tiene ese problema —la tabla lo marca ancho y los tres
 * cuentan 2—, y el `✓` tampoco —los tres cuentan 1—.
 */
function columnas(s: string): number {
  return s.length + (s.match(/[✅⚠]/gu)?.length ?? 0)
}

/**
 * Parte el marcador en los trozos que caben en `width`, en orden de izquierda
 * a derecha y **por grupos enteros**.
 *
 * Por grupos y no trozo a trozo porque cada uno va detrás de su separador: con
 * el corte a mitad de grupo la línea acabaría en un `▏` colgando, apuntando a
 * un dato que no está. Lo que no cabe se cae por la derecha, que es el orden en
 * que importa: las dos cifras que se comparan, el neto que resume y lo tuyo.
 *
 * Si no cabe ni la primera cifra no se devuelve nada y el panel no pinta la
 * fila: en un panel de ese ancho un marcador cortado ocupa una fila de la mesa
 * para no decir nada.
 */
export function trozosDePulso(p: Pulso, width: number): Trozo[] {
  const neto = p.cierran - p.abren
  const sitio = p.puesto !== undefined && p.personas !== undefined ? ` · ${p.puesto}.º/${p.personas}` : ''
  const grupos: Trozo[][] = [
    [{ text: `SEMANA ${p.tramo ? `${p.tramo} ` : ''} `, tono: 'rotulo' }],
    // `+` lo que entra y `-` lo que se termina, en lugar de las palabras: dos
    // glifos de una columna que se leen sin leerlos, y son **el mismo par**, así
    // que el ojo los empareja sin que nada se lo explique.
    //
    // El guion es el de teclado y no el menos tipográfico `−`: es el par exacto
    // del `+` que lleva al lado y está en todas las monoespaciadas, mientras que
    // el `−` se pinta como un cuadrito en las que no lo traen.
    //
    // 🔴 **Las subtareas no se pintan**, aunque la mesa las cuente: siguen fuera
    // de `abren` y de `cierran` —contarlas premia a quien desglosa— y quedan en
    // el fichero, en `subtareas`, para quien lo abra. En la fila eran un tercer
    // número que había que explicar cada vez, y la fila existe para no tener que
    // explicar nada.
    [{ text: `+ ${p.abren}`, tono: 'abren' }],
    [
      { text: ' ▏', tono: 'sep' },
      { text: `- ${p.cierran}`, tono: 'cierran' },
    ],
    [
      { text: ' ▏', tono: 'sep' },
      // La flecha dice el sentido y el color lo confirma: ▲ verde cuando se
      // cierra más de lo que entra, ▼ rojo cuando no. Y es flecha, y no el signo
      // del neto, porque los dos signos ya están ocupados a su izquierda
      // diciendo otra cosa: un `−4` detrás de un `+ 16 ▏- 12` es el tercer
      // signo de la fila.
      { text: `${neto >= 0 ? '▲' : '▼'}${Math.abs(neto)}`, tono: neto >= 0 ? 'gana' : 'pierde' },
    ],
  ]
  if (p.tuyos !== undefined) {
    grupos.push([
      { text: ' ▏', tono: 'sep' },
      { text: `tú ${p.tuyos}${sitio}`, tono: 'tu' },
    ])
  }
  const trozos: Trozo[] = []
  let ancho = 0
  for (const grupo of grupos) {
    const suma = grupo.reduce((n, t) => n + columnas(t.text), 0)
    if (ancho + suma > width) break
    trozos.push(...grupo)
    ancho += suma
  }
  // Con el rótulo solo no hay marcador: o entra una cifra o no se pinta la fila.
  return trozos.some(t => t.tono === 'abren') ? trozos : []
}

/**
 * Las columnas que ocupa `s` en el terminal, contando por punto de código.
 *
 * Un emoji de presentación —`🐞`, `✅`, `📖`, `❔`, `🚧`— ocupa dos; los
 * selectores de variación y las marcas que se combinan no ocupan nada; el
 * resto, una. No es la tabla entera del terminal, pero es la que pisan los
 * glifos que escribe la mesa, y se queda corta antes que larga: `▶` sin
 * selector se cuenta como uno, que es como lo pinta el terminal.
 *
 * Por punto de código y no con `length`: un `🐞` son dos unidades de UTF-16 y
 * un `✅` una, y los dos ocupan dos columnas.
 */
export function anchoEnTerminal(s: string): number {
  let n = 0
  for (const c of s) {
    if (/[\u{FE00}-\u{FE0F}\u{200D}\p{M}]/u.test(c)) continue
    n += /\p{Emoji_Presentation}/u.test(c) ? 2 : 1
  }
  return n
}

/**
 * Recorta `s` para que no pase de `n` columnas, con `…` al final si recorta.
 *
 * El `cut` del panel cuenta caracteres, y con un emoji delante una línea
 * «recortada al ancho» se pasa una columna, envuelve y se come la fila de
 * debajo. Este cuenta columnas.
 */
export function recortar(s: string, n: number): string {
  if (anchoEnTerminal(s) <= n) return s
  if (n <= 0) return ''
  let out = ''
  let ancho = 0
  for (const c of s) {
    const w = anchoEnTerminal(c)
    if (ancho + w > n - 1) break
    out += c
    ancho += w
  }
  return out + '…'
}

/**
 * La línea de un ticket, que **nunca pasa de `width` columnas**.
 *
 * El panel reparte la ventana de la mesa contando una fila por ticket: una
 * línea que se pasa del ancho envuelve, ocupa dos, y lo que sobra lo pierde la
 * caja de arriba por algún sitio —en la 1.6.0, la fila del marcador cuando
 * había post-it—. Hasta la 1.6.0 el resumen se recortaba al ancho menos un
 * prefijo fijo y **después** se le pegaba ` → dueño` sin descontarlo, así que
 * todo ticket con dueño se pasaba.
 *
 * El dueño tiene tope —un cuarto del ancho, y nunca menos de 8— para que un
 * nombre largo no deje el resumen en nada: el resumen es lo que dice de qué
 * va el ticket, y el dueño se reconoce por el principio. Y por si el panel es
 * tan estrecho que ni así cabe, la línea entera se recorta al final.
 *
 * Deja una columna libre: es el margen para el glifo que un terminal pinte
 * más ancho de lo que dice la tabla, que una fila de menos no se nota y una de
 * más descuadra la mesa.
 */
export function lineaDeTicket(t: Ticket, width: number): string {
  const ancho = Math.max(1, width - 1)
  const prefijo = `${t.mark} ${t.tipo ? `${t.tipo} ` : ''}${t.key} ${t.priority.padEnd(4)} `
  const dueno = t.owner ? ` → ${recortar(t.owner, Math.max(8, Math.floor(width / 4)))}` : ''
  const hueco = Math.max(10, ancho - anchoEnTerminal(prefijo) - anchoEnTerminal(dueno))
  return recortar(`${prefijo}${recortar(t.summary, hueco)}${dueno}`, ancho)
}


/**
 * La frase de arranque si en `/config` no se puso ninguna: la que sirve a
 * cualquier equipo, tenga o no un fichero de flujo de trabajo.
 */
export const FRASE_ARRANQUE = 'arranca {clave}'

/**
 * La frase que el `▷` de un ticket le envía a Claude, con lo que se haya
 * escrito en el diálogo pegado al final.
 *
 * `{clave}` y `{titulo}` se sustituyen todas las veces que salgan. Una
 * plantilla en blanco es no haber configurado nada, y vale la de por defecto.
 * Una plantilla sin `{clave}` lleva la clave al final: una frase que no dice
 * qué ticket arrancar no arranca ninguno.
 */
export function fraseDeArranque(
  plantilla: string | undefined,
  t: Pick<Ticket, 'key' | 'summary'>,
  extra?: string,
): string {
  const base = plantilla?.trim() || FRASE_ARRANQUE
  const conClave = base.includes('{clave}') ? base : `${base} {clave}`
  const frase = conClave.replaceAll('{clave}', t.key).replaceAll('{titulo}', t.summary)
  const mas = extra?.trim()
  return mas ? `${frase} ${mas}` : frase
}

/**
 * La dirección del ticket en Jira, con la URL de `/config`; `undefined`
 * cuando no hay URL o no es `https://`, y entonces la clave no es enlace.
 */
export function urlDeTicket(base: string | undefined, key: string): string | undefined {
  const b = (base ?? '').trim().replace(/\/+$/u, '')
  if (!/^https:\/\/[^\s/]+/u.test(b) || !CLAVE.test(key)) return undefined
  return `${b}/browse/${encodeURIComponent(key)}`
}

/**
 * La línea de un ticket partida en tres para que la clave sea un botón:
 * lo de antes (marca y tipo), la clave y lo de después, ya rellenado hasta
 * `cols` columnas. Juntas son `lineaDeTicket(t, cols + 1)` con relleno.
 *
 * Si el recorte se comió la clave —un panel absurdamente estrecho— todo va
 * en `despues` y no hay botón: un trozo de clave no abre nada que se sepa.
 */
export function trozosDeTicket(t: Ticket, cols: number): { antes: string; clave: string; despues: string } {
  const linea = lineaDeTicket(t, cols + 1)
  const relleno = ' '.repeat(Math.max(0, cols - anchoEnTerminal(linea)))
  const antes = `${t.mark} ${t.tipo ? `${t.tipo} ` : ''}`
  if (!linea.startsWith(antes + t.key)) return { antes: '', clave: '', despues: linea + relleno }
  return { antes, clave: t.key, despues: linea.slice(antes.length + t.key.length) + relleno }
}
