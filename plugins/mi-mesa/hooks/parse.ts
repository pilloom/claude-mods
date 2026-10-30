import type { Hilo, Mesa, Notas, Prompt, Ticket } from '../types'

/**
 * Una línea de ticket: marca, clave, prioridad y el resto.
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
const TICKET = /^(▶|·|🚧)\s+([A-Z][A-Z0-9]*-\d+)\s+(\S+)\s+(.*)$/u

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
      const [, mark = '', key = '', priority = '', cola = ''] = m
      const ticket: Ticket = { mark, key, priority, ...partirCola(cola) }
      current.tickets.push(ticket)
    }
  }
  // `generador` solo si la cabecera lo dice: una mesa sin él no gana un campo
  // vacío, y quien resuelve el guion sabe que ahí no hay nada que mirar.
  return {
    generated,
    hilos: hilos.filter(h => h.tickets.length > 0),
    mtimeMs,
    ...(generador === undefined ? {} : { generador }),
  }
}

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
