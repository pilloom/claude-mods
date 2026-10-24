import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mesa, Notas, Prompt } from '../types'
import { parseHistory, parseMesa, parseNotas } from './parse'

const PANE = 'mi-mesa'
const MESA_FILE = 'docs/MI-MESA.md'
/**
 * El post-it, en la raíz y no en `docs/`: es un fichero que el repositorio
 * versiona a propósito, para que la nota viaje con la rama, mientras la mesa
 * se genera y no se sube.
 */
const NOTAS_FILE = 'NOTAS.md'
/** Cuántas líneas del post-it caben antes de que se diga cuántas quedan. */
const NOTAS_MAX = 5
/** El clip que suena al acabar el turno; es un fichero del propio mod. */
const SONIDO = 'sounds/listo.wav'
/** Cuántos de tus mensajes guarda y pinta el cuarto de abajo. */
const ULTIMOS = 10
/** Cola del historial que se lee: de sobra para sacar 10 de este repo entre los cuatro. */
const COLA = 1200
const EMPTY: Mesa = { repo: '', generated: '?', hilos: [], mtimeMs: 0 }
const SIN_NOTAS: Notas = { lines: [], mtimeMs: 0 }
const mesa = atom({ plugin: 'mi-mesa', key: 'mesa' } as const, EMPTY)
const prompts = atom({ plugin: 'mi-mesa', key: 'prompts' } as const, [] as Prompt[])
const notas = atom({ plugin: 'mi-mesa', key: 'notas' } as const, SIN_NOTAS)

// La mesa es la del repo en el que corre la sesión: backend, front o el que
// tenga su docs/MI-MESA.md. El título del panel lleva el nombre de esa carpeta.
async function repoOf($: EngineInterface): Promise<{ root: string; repo: string; file: string }> {
  const root = await $.session.root()
  return { root, repo: root.split('/').filter(Boolean).pop() ?? root, file: `${root}/${MESA_FILE}` }
}

// Relee solo si el fichero cambió: listar-mi-mesa.js lo reescribe entero.
async function refresh($: EngineInterface): Promise<void> {
  const { repo, file } = await repoOf($)
  try {
    if (!(await $.fs.exists(file))) {
      await update($, mesa, () => ({ ...EMPTY, repo, error: `No hay ${MESA_FILE} en ${repo}` }))
      return
    }
    const { mtimeMs } = await $.fs.stat(file)
    const prev = await read($, mesa)
    if (mtimeMs === prev.mtimeMs && prev.repo === repo && !prev.error) return
    const text = await $.fs.read(file)
    await update($, mesa, () => ({ ...parseMesa(text, mtimeMs), repo }))
  } catch (err) {
    await update($, mesa, m => ({ ...m, repo, error: String(err) }))
  }
}

/**
 * Relee NOTAS.md con el mismo trato que la mesa: solo si cambió el `mtime`.
 *
 * Que no haya fichero no es un error y no se pinta como tal, al contrario que
 * con la mesa: el post-it es opcional y su ausencia es el caso normal, así que
 * se vuelve al estado vacío y la sección desaparece. `mtimeMs: 0` es ese
 * estado, el de no tener fichero y el de tenerlo sin ninguna línea útil.
 */
async function refreshNotas($: EngineInterface): Promise<void> {
  const { root } = await repoOf($)
  const file = `${root}/${NOTAS_FILE}`
  try {
    if (!(await $.fs.exists(file))) {
      const prev = await read($, notas)
      if (prev.mtimeMs !== 0 || prev.lines.length > 0) await update($, notas, () => SIN_NOTAS)
      return
    }
    const { mtimeMs } = await $.fs.stat(file)
    const prev = await read($, notas)
    if (mtimeMs === prev.mtimeMs) return
    const text = await $.fs.read(file)
    await update($, notas, () => parseNotas(text, mtimeMs))
  } catch {
    // Un post-it ilegible no tira el panel: se queda con lo que ya tenía.
  }
}

/**
 * Relee la cola del historial y deja la lista entera, no un añadido.
 *
 * Se lee con `tail` y no con `$.fs.read` porque el fichero es global y crece
 * sin tope —7,5 MB en esta máquina— y el panel solo necesita el final; traerlo
 * completo cada 15 s por cinco líneas no se paga. Que reemplace en vez de
 * acumular es lo que deshace el duplicado del apunte optimista de
 * `prompt.submit`: el historial guarda lo que se teclea y el evento lo que
 * llega al modelo (los pegados ya expandidos), así que los dos textos pueden
 * no coincidir y solo uno de ellos es el que manda.
 */
async function refreshPrompts($: EngineInterface): Promise<void> {
  const { root } = await repoOf($)
  try {
    const { exitCode, stdout } = await $.process.run([
      'sh',
      '-c',
      `tail -n ${COLA} "$HOME/.claude/history.jsonl"`,
    ])
    if (exitCode !== 0) return
    const leidos = parseHistory(stdout, root, ULTIMOS)
    // Un historial que aún no tiene nada de este repo no borra el apunte vivo.
    if (leidos.length === 0) return
    await update($, prompts, () => leidos)
  } catch {
    // Sin historial legible el tercio de abajo se queda con lo de esta sesión.
  }
}

async function openPane($: EngineInterface): Promise<void> {
  const { repo } = await repoOf($)
  await $.ui.open({ id: PANE, title: `Mi mesa · ${repo}` })
}

/** `hh:mm` de un apunte; vacío si no trae hora. */
function hora(at: number): string {
  if (!at) return '--:--'
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const register: Register = (on, options) => {
  // El sonido se puede apagar desde /config: es la clase de añadido que una
  // máquina compartida o una videollamada quieren callar sin desinstalar nada.
  const suena = options.sonido !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mi-mesa',
      description: 'Abre el panel con los tickets de docs/MI-MESA.md del repo',
    })
    await refresh($)
    await refreshNotas($)
    await refreshPrompts($)
    $.clock.every(15_000, async () => {
      await refresh($)
      await refreshNotas($)
      await refreshPrompts($)
    })
    void openPane($)
    return next(e)
  })

  on('command.run', { command: 'mi-mesa' }, async $ => {
    await refresh($)
    await refreshNotas($)
    await refreshPrompts($)
    await openPane($)
    return { text: 'Panel de la mesa abierto.' }
  })

  // Apunte optimista: el host escribe el historial a su ritmo y el panel no
  // debe esperar al siguiente ciclo para enseñar lo que acabas de mandar.
  on('prompt.submit', ($, e, next) => {
    const text = e.text.trim().replace(/\s+/gu, ' ')
    // Sin `await` y con el fallo tragado: este hook está en el camino del
    // prompt y lo que apunta es decorativo, así que no puede ni frenar ni
    // comerse lo que acabas de mandar. El ciclo de 15 s lo recupera del
    // historial de todas formas.
    if (text && !text.startsWith('/')) {
      void update($, prompts, prev => [{ text, at: Date.now() }, ...prev].slice(0, ULTIMOS)).catch(
        () => {},
      )
    }
    return next(e)
  })

  /**
   * Un sonido cuando Claude acaba de contestar.
   *
   * Solo con `reason: 'answer'` y solo en el bucle principal: un turno que
   * levanta cinco subagentes termina seis veces, y sin el filtro de `agentId`
   * sonaría seis. Una interrupción, un error de la API o un rechazo callan,
   * que es lo que se pidió: el aviso es de «ya está», no de «pasó algo».
   *
   * `play` solo suena en macOS, donde el motor tiene `afplay`; en Linux o
   * Windows no suena nada y no falla. Se lanza sin `await` y con el fallo
   * tragado para no retrasar ni romper la respuesta por un clip.
   */
  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (suena && e.reason === 'answer' && e.agentId === undefined && !e.isAborted) {
      void $.audio.play({ asset: SONIDO }).catch(() => {})
    }
    return res
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const m = await read($, mesa)
    const ultimos = await read($, prompts)
    const post = await read($, notas)
    const total = m.hilos.reduce((n, hilo) => n + hilo.tickets.length, 0)
    // El ancho es el del cuerpo del Pane, que es lo que una barra o una regla
    // de ancho completo tiene que medir: el del viewport es el de la pantalla,
    // y con el panel acoplado al lado del transcript se pasa y la línea envuelve.
    const width = e.props?.bodyColumns || Math.max(30, (e.viewport?.columns ?? 60) - 4)
    const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

    // El alto del cuerpo lo da el propio Pane; el viewport trae el de la pantalla
    // entera y no el hueco de este sitio, así que no sirve para partir. Sin él
    // —un test que monta sin props, una superficie que no lo manda— no se parte
    // nada: las dos secciones van seguidas y el tercio de abajo no desaparece.
    const rows = e.props?.scroll?.bodyRows ?? 0
    // El post-it se queda las filas que necesite —una por nota, más la del
    // rótulo— y el resto se reparte como antes. Lo que no cabe no se recorta a
    // la mitad: se dice cuántas notas quedan sin pintar, y el fichero se abre
    // para verlas. Sin notas no ocupa nada y el panel sale como siempre.
    const pintadas = post.lines.slice(0, NOTAS_MAX)
    const restan = post.lines.length - pintadas.length
    const altoNotas = pintadas.length > 0 ? pintadas.length + 1 : 0
    // Lo que queda para la mesa y los mensajes, ya sin el post-it.
    const libres = Math.max(0, rows - altoNotas)
    const parte = rows >= 12 && libres >= 10
    const abajo = parte ? Math.max(4, libres - Math.ceil((libres * 3) / 4)) : 0
    const arriba = parte ? libres - abajo : undefined
    // La línea y el rótulo se quedan dos de las filas del cuarto de abajo.
    const caben = parte ? Math.max(1, abajo - 2) : ULTIMOS

    return (
      <Box flexDirection="column">
        {/* El post-it, y solo cuando hay algo escrito.
            El rótulo es negro sobre amarillo, los dos colores dichos, y no
            `inverse` sobre amarillo: `inverse` pinta el texto del color del
            FONDO del tema, que en un tema claro es blanco, y blanco sobre
            amarillo no se lee. Negro sobre amarillo es el contraste del
            post-it de verdad, y el mismo en tema claro y en oscuro.
            Las notas van en el color normal del texto: en amarillo sobre el
            fondo del panel salían apagadas, y el amarillo ya lo pone el
            rótulo. Lo que tiene que leerse es la nota. */}
        {altoNotas > 0 ? (
          <Box flexDirection="column" height={altoNotas} overflow="hidden" flexShrink={0}>
            <Text bold color="black" backgroundColor="yellow">
              {` NOTAS${restan > 0 ? ` · +${restan}` : ''} `.padEnd(width)}
            </Text>
            {pintadas.map((l, i) => (
              <Text key={`nota-${i}`}>{cut(l, width)}</Text>
            ))}
          </Box>
        ) : null}
        <Box flexDirection="column" height={arriba} overflow="hidden" flexShrink={0}>
          {/* Barra de ancho completo: `inverse` pinta el fondo del color y el
              texto del fondo, así que el rótulo se lee como un título y no
              como una línea más de las muchas que lleva el panel. */}
          <Text bold inverse color="cyan">
            {` MI MESA · ${(m.repo || 'sin repo').toUpperCase()} `.padEnd(width)}
          </Text>
          <Text dimColor>
            {`${total} tickets · ${m.hilos.length} hilos · generada ${m.generated}`}
          </Text>
          {m.error ? <Text color="red">{cut(m.error, width)}</Text> : null}
          {m.hilos.map(hilo => (
            <Box key={hilo.title} flexDirection="column" marginTop={1}>
              <Text color="cyan">{cut(hilo.title, width)}</Text>
              {hilo.tickets.map(t => (
                <Text key={t.key} dimColor={t.mark === '·'}>
                  {`${t.mark} ${t.key} ${t.priority.padEnd(4)} ${cut(t.summary, Math.max(10, width - 20))}${t.owner ? ` → ${t.owner}` : ''}`}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
        <Box flexDirection="column" height={abajo || undefined} overflow="hidden" flexShrink={0}>
          {/* Una raya fina, no una fila con el fondo pintado: esa salía gruesa.
              Negra como el rótulo, que es lo que contrasta en este tema; en uno
              oscuro las dos se verían apagadas y habría que subirlas de color. */}
          <Text color="black">{'─'.repeat(width)}</Text>
          <Text bold color="black">{`Últimos mensajes (${ultimos.length})`}</Text>
          {ultimos.length === 0 ? <Text dimColor>Nada todavía en este repo.</Text> : null}
          {ultimos.slice(0, caben).map((p, i) => (
            <Text key={`${p.at}-${i}`} dimColor={i > 0}>
              {`${hora(p.at)} ${cut(p.text, Math.max(10, width - 6))}`}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
