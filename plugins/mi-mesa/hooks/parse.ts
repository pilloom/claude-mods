import type { Hilo, Mesa, Prompt, Ticket } from '../types'

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
 * Lee del Markdown generado por listar-mi-mesa.js solo los tickets, en el
 * orden y el hilo en que salen. Se para en «Lo que NO está aquí», que no es
 * la mesa sino lo que se queda fuera.
 */
export function parseMesa(text: string, mtimeMs: number): Omit<Mesa, 'repo'> {
  const generated = /generado\*\* por .*? el (\d{4}-\d{2}-\d{2})/i.exec(text)?.[1] ?? '?'
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
  return { generated, hilos: hilos.filter(h => h.tickets.length > 0), mtimeMs }
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
