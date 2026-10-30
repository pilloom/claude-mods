import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mesa, Notas, Prompt, Regen } from '../types'
import {
  anadirNota,
  comandoDe,
  envolver,
  GUIONES,
  parseHistory,
  parseMesa,
  parseNotas,
  quitarNota,
  quitarNotaN,
} from './parse'

const PANE = 'mi-mesa'
const MESA_FILE = 'docs/MI-MESA.md'
/**
 * El post-it, en la raíz y no en `docs/`: es lo que tienes encima de la mesa
 * en ese repositorio, y se quiere verlo al entrar sin bajar a ninguna carpeta.
 *
 * No lo versiona el repositorio: son las notas de una persona, como la mesa, y
 * lo que alguien apunta para sí mismo no viaja en una rama ni sale en un PR.
 * El mod lo apunta solo en `.git/info/exclude`, que es el sitio de los ignores
 * de quien tiene el clon: así protege también los repositorios de los demás
 * sin pedirle a nadie que commitee una línea en el `.gitignore` de todos.
 */
const NOTAS_FILE = 'NOTAS.md'
/** Los ignores de este clon, que no se commitean: ahí va el post-it. */
const EXCLUDE_FILE = '.git/info/exclude'
/** Con la barra delante, el de la raíz y no un NOTAS.md de cualquier carpeta. */
const EXCLUDE_LINEA = '/NOTAS.md'
/** Cuántas notas se pintan como mucho antes de que se diga cuántas quedan. */
const NOTAS_MAX = 5
/** Lo que la equis de quitar le come a cada nota: el glifo y su espacio. */
const MARGEN = 2
/** El clip que suena al acabar el turno; es un fichero del propio mod. */
const SONIDO = 'sounds/listo.wav'
/** La herramienta del mod, como la nombra el motor y la llama el modelo. */
const HERRAMIENTA = 'mcp__mi-mesa__nota'
/** Cuántos de tus mensajes guarda y pinta el cuarto de abajo. */
const ULTIMOS = 10
/** Cola del historial que se lee: de sobra para sacar 10 de este repo entre los cuatro. */
const COLA = 1200
/**
 * Lo que se le da al guion de la mesa antes de matarlo, en milisegundos.
 *
 * Un minuto es largo para lo que tarda y corto para colgar el panel: el guion
 * consulta el gestor de tickets, así que una red lenta no es un fallo, pero
 * tampoco se espera indefinidamente a un proceso que no vuelve.
 */
const REGEN_TIMEOUT = 60_000
/** Lo que hay que contestar a la confirmación para que el guion corra. */
const CONFIRMA = 'Regenerar'
const EMPTY: Mesa = { repo: '', generated: '?', hilos: [], mtimeMs: 0 }
const SIN_NOTAS: Notas = { lines: [], mtimeMs: 0 }
const QUIETO: Regen = { fase: 'quieto' }
const mesa = atom({ plugin: 'mi-mesa', key: 'mesa' } as const, EMPTY)
const prompts = atom({ plugin: 'mi-mesa', key: 'prompts' } as const, [] as Prompt[])
const notas = atom({ plugin: 'mi-mesa', key: 'notas' } as const, SIN_NOTAS)
const regen = atom({ plugin: 'mi-mesa', key: 'regen' } as const, QUIETO)

/**
 * El guion de la mesa que se haya puesto en `/config`, si se puso.
 *
 * Es de módulo, como `suena` lo es del `register`: las funciones que resuelven
 * el guion son de módulo también y `options` solo llega al `register`, que lo
 * deja aquí una vez. Es el escape para el repositorio raro —el que genera su
 * mesa de otra manera, o con el guion en otro sitio— y lo normal es que esté
 * vacío y manden la cabecera del fichero y la convención.
 */
let configurado: string | undefined

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
      // Sin fichero no hay cabecera que nombre el guion, y es justo cuando más
      // falta hace el botón: la primera generación. Queda la convención.
      await refreshGuion($)
      return
    }
    const { mtimeMs } = await $.fs.stat(file)
    const prev = await read($, mesa)
    if (mtimeMs === prev.mtimeMs && prev.repo === repo && !prev.error) return
    const text = await $.fs.read(file)
    const leida = parseMesa(text, mtimeMs)
    await update($, mesa, () => ({ ...leida, repo }))
    await refreshGuion($, leida.generador)
  } catch (err) {
    await update($, mesa, m => ({ ...m, repo, error: String(err) }))
  }
}

/**
 * Deja en el atom la ruta del guion que regenera la mesa de este repositorio.
 *
 * Tres fuentes, en este orden: lo que se haya puesto en `/config`, lo que la
 * cabecera del fichero generado dice que lo escribió, y la convención de los
 * repositorios de la casa. La primera que exista en disco y pase `comandoDe`
 * es la que queda; si no pasa ninguna, no hay guion y el panel no pinta el
 * botón, que es mejor que un control que no puede hacer nada.
 *
 * Se resuelve aquí y no al dibujar porque mirar el disco en cada redibujado se
 * paga, y lo que se busca no cambia de un dibujado al siguiente.
 */
async function refreshGuion($: EngineInterface, enCabecera?: string): Promise<void> {
  const prev = await read($, regen)
  // Con una confirmación abierta o un guion corriendo no se le cambia el guion
  // debajo: el `refresh` de después de regenerar pasa por aquí, y lo que se
  // está ejecutando —o lo que se acaba de preguntar— manda.
  if (prev.fase !== 'quieto') return
  const guion = await buscarGuion($, [configurado, enCabecera, ...GUIONES])
  if (guion === prev.guion) return
  await update($, regen, r => ({ ...r, guion }))
}

/** La primera de las rutas candidatas que se acepta y además está en disco. */
async function buscarGuion(
  $: EngineInterface,
  candidatas: (string | undefined)[],
): Promise<string | undefined> {
  const { root } = await repoOf($)
  for (const ruta of candidatas) {
    if (!ruta || comandoDe(ruta) === undefined) continue
    try {
      if (await $.fs.exists(`${root}/${ruta}`)) return ruta
    } catch {
      // Una ruta que no se deja mirar es una ruta que no se usa.
    }
  }
  return undefined
}

/**
 * Pregunta y, si se dice que sí, corre el guion y relee lo que haya escrito.
 *
 * Se pregunta **con el guion delante**: lo que se va a ejecutar sale de la
 * cabecera de un fichero versionado, así que lo que el panel enseña antes de
 * correrlo es el comando entero, y quien lo lee ve si es el suyo. `comandoDe`
 * ya acota lo que puede llegar aquí —`argv` y nunca `sh -c`, el intérprete
 * puesto por la extensión, ruta relativa de dentro del repositorio—; la
 * confirmación es la segunda vuelta de lo mismo, con una persona mirando.
 *
 * Cualquier respuesta que no sea exactamente `CONFIRMA` deja todo como estaba,
 * y eso incluye el texto libre del «Other» del diálogo: ahí se escribe una
 * duda, no un sí. Un diálogo cerrado con escape, o una sesión sin nadie a quien
 * preguntar (`-p`), hacen que `ask` reviente, y es el mismo caso.
 *
 * Dos pulsaciones no abren dos diálogos ni lanzan dos guiones: la fase lo corta
 * en la segunda. Y lo que falle se queda en el atom en vez de tirar el panel,
 * con la salida del guion recortada a su primera línea, que es donde dice qué
 * pasó.
 */
async function regenerar($: EngineInterface): Promise<void> {
  const { root } = await repoOf($)
  const prev = await read($, regen)
  if (prev.fase !== 'quieto' || prev.guion === undefined) return
  const argv = comandoDe(prev.guion)
  if (argv === undefined) return
  await update($, regen, r => ({ fase: 'preguntando' as const, guion: r.guion }))
  if (!(await confirmar($, argv))) {
    await update($, regen, r => ({ fase: 'quieto' as const, guion: r.guion }))
    return
  }
  await update($, regen, r => ({ fase: 'corriendo' as const, guion: r.guion }))
  try {
    const { exitCode, stdout, stderr } = await $.process.run(argv, {
      cwd: root,
      timeoutMs: REGEN_TIMEOUT,
    })
    const dicho = (stderr.trim() ? stderr : stdout).split('\n').find(l => l.trim())?.trim() ?? ''
    await update($, regen, r => ({
      fase: 'quieto' as const,
      guion: r.guion,
      error: exitCode === 0 ? undefined : `${prev.guion} salió con ${exitCode}. ${dicho}`,
    }))
  } catch (err) {
    // Un guion que no existe ya, un intérprete que no está, el minuto agotado.
    await update($, regen, r => ({ fase: 'quieto' as const, guion: r.guion, error: String(err) }))
  }
  // La mesa la acaba de reescribir el guion: se relee sin esperar al ciclo.
  await refresh($)
}

/**
 * Pregunta si se corre el comando, y solo cuenta como sí la opción de correrlo.
 *
 * El diálogo es el del motor (`$.ui.ask`), el mismo con el que se pregunta todo
 * lo demás en la sesión: no hay que aprenderse otro, y en un `-p` —donde no hay
 * nadie a quien preguntar— revienta, que es exactamente lo que se quiere que
 * pase antes de ejecutar nada sin que nadie lo vea.
 */
async function confirmar($: EngineInterface, argv: readonly string[]): Promise<boolean> {
  try {
    const dicho = await $.ui.ask(`¿Regenerar la mesa con «${argv.join(' ')}»?`, {
      options: [CONFIRMA, 'Dejarlo'],
      header: 'Mi mesa',
    })
    return dicho === CONFIRMA
  } catch {
    // Cerrado con escape, o una sesión en la que no hay a quién preguntar.
    return false
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
    // Las dos comprobaciones de git cuelgan de aquí y no del ciclo: con el
    // `mtime` igual se ha vuelto ya, así que solo corren cuando el post-it
    // cambia, y no cada 15 s por un fichero que nadie ha tocado.
    await ignorar($, root)
    const versionado = await enGit($, root)
    await update($, notas, () => ({ ...parseNotas(text, mtimeMs), enGit: versionado }))
  } catch {
    // Un post-it ilegible no tira el panel: se queda con lo que ya tenía.
  }
}

/**
 * Apunta el post-it en los ignores de este clon, si no lo está ya.
 *
 * En `.git/info/exclude` y no en el `.gitignore` del repositorio: el fichero
 * es personal, y un mod no tiene por qué meter una línea en algo que los demás
 * se van a encontrar en el diff. Un `.gitignore` que ya lo ignore —el de este
 * mismo repositorio, el que alguien puso a mano— se respeta y no se duplica.
 *
 * Lo que falle aquí se traga: un `.git` que es un fichero (un worktree, un
 * submódulo), una carpeta sin permiso o un sitio que no es un repositorio
 * dejan el post-it funcionando igual, solo que sin proteger.
 */
async function ignorar($: EngineInterface, root: string): Promise<void> {
  const dicho = (texto: string) =>
    texto.split('\n').some(l => l.trim() === EXCLUDE_LINEA || l.trim() === NOTAS_FILE)
  try {
    if (!(await $.fs.exists(`${root}/.git/info`))) return
    const gitignore = `${root}/.gitignore`
    if ((await $.fs.exists(gitignore)) && dicho(await $.fs.read(gitignore))) return
    const file = `${root}/${EXCLUDE_FILE}`
    const antes = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
    if (dicho(antes)) return
    const salto = antes === '' || antes.endsWith('\n') ? '' : '\n'
    await $.fs.write(
      file,
      `${antes}${salto}# El post-it de «Mi mesa»: notas de quien usa este clon.\n${EXCLUDE_LINEA}\n`,
    )
  } catch {
    // Sin poder apuntarlo, el post-it sigue; lo que no hay es la protección.
  }
}

/**
 * Si el repositorio ya versiona el post-it, que es de lo que hay que avisar.
 *
 * `exclude` no desversiona nada: en un repositorio donde alguien lo commiteó
 * antes, el fichero sigue dentro y los recordatorios de esa persona salen en
 * el siguiente PR. De ahí solo se sale a mano, con `git rm --cached`, así que
 * el panel lo dice en el rótulo hasta que se haga.
 */
async function enGit($: EngineInterface, root: string): Promise<boolean> {
  try {
    const { exitCode } = await $.process.run([
      'git',
      '-C',
      root,
      'ls-files',
      '--error-unmatch',
      NOTAS_FILE,
    ])
    return exitCode === 0
  } catch {
    // Sin git, o fuera de un repositorio, no hay nada de lo que avisar.
    return false
  }
}

/** La ruta del post-it del repositorio de la sesión. */
async function notasFile($: EngineInterface): Promise<string> {
  const { root } = await repoOf($)
  return `${root}/${NOTAS_FILE}`
}

/** Lo que hay escrito ahora, o cadena vacía si todavía no hay fichero. */
async function leerNotas($: EngineInterface, file: string): Promise<string> {
  return (await $.fs.exists(file)) ? await $.fs.read(file) : ''
}

/**
 * Las tres operaciones sobre el post-it, en un solo sitio.
 *
 * La herramienta y `/nota` llaman aquí las dos: pasan por el mismo código y
 * escriben el mismo formato, que es lo que evita que acaben siendo dos post-its
 * distintos según por dónde entres. Devuelven la frase que se lee, porque las
 * dos tienen que decir qué pasó —una al modelo y otra a ti— y conviene que
 * digan lo mismo.
 *
 * Tras escribir se relee: el panel no espera al ciclo de 15 s para enseñar la
 * nota que acabas de dictar.
 */
async function nota(
  $: EngineInterface,
  accion: 'anadir' | 'quitar' | 'listar',
  texto: string,
): Promise<string> {
  const file = await notasFile($)
  const antes = await leerNotas($, file)
  const hay = parseNotas(antes, 1).lines

  if (accion === 'listar') {
    return hay.length === 0
      ? `No hay notas en ${NOTAS_FILE}.`
      : `${hay.length} ${hay.length === 1 ? 'nota' : 'notas'} en ${NOTAS_FILE}:\n${hay.join('\n')}`
  }

  if (accion === 'anadir') {
    if (!texto.trim()) return 'Hace falta el texto de la nota.'
    await $.fs.write(file, anadirNota(antes, texto))
    await refreshNotas($)
    return `Añadida a ${NOTAS_FILE} (${hay.length + 1} en total).`
  }

  if (!texto.trim()) return 'Hace falta decir qué nota se quita.'
  const { texto: despues, quitada, candidatas } = quitarNota(antes, texto)
  if (quitada === undefined) {
    // Con cero o con varias no se toca nada: borrar la equivocada es peor.
    return candidatas.length === 0
      ? `Ninguna nota de ${NOTAS_FILE} dice «${texto}». Las que hay:\n${hay.join('\n') || '(ninguna)'}`
      : `«${texto}» casa con ${candidatas.length} notas y no se quitó ninguna. Hay que concretar:\n${candidatas.join('\n')}`
  }
  await $.fs.write(file, despues)
  await refreshNotas($)
  return `Quitada de ${NOTAS_FILE}: ${quitada}`
}

/**
 * Quita la nota número `n` del post-it: lo que hace la equis del panel.
 *
 * No pasa por `nota($, 'quitar', …)` porque esa busca por el texto y se niega
 * cuando hay duda, que es lo correcto cuando te lo dictan y lo que no tiene
 * sentido aquí: la equis señala una nota con el dedo, y dos notas iguales se
 * distinguen por su sitio. `esperada` es lo que estaba pintado en ese sitio,
 * para no borrar la de al lado si el fichero cambió desde el último redibujado.
 *
 * No devuelve nada: quien lo llama es un botón, no alguien esperando una
 * frase. Lo que pasó se ve en el panel, que se relee al momento, y si no se
 * quitó nada se relee igual y lo que sale es lo que hay de verdad.
 */
async function quitarPorNumero($: EngineInterface, n: number, esperada: string): Promise<void> {
  const file = await notasFile($)
  const { texto, quitada } = quitarNotaN(await leerNotas($, file), n, esperada)
  if (quitada !== undefined) await $.fs.write(file, texto)
  await refreshNotas($)
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
  // El guion de la mesa, si se puso: lo normal es que no y manden la cabecera
  // del fichero y la convención. Se guarda crudo; `comandoDe` decide si vale.
  configurado = typeof options.generador === 'string' ? options.generador.trim() : undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mi-mesa',
      description: 'Abre el panel con los tickets de docs/MI-MESA.md del repo',
    })
    await $.command.register({
      name: 'nota',
      description: 'Añade una nota al post-it del panel; --quitar <texto> la quita, sin nada las lista',
    })
    // `isDeferred: false`: con la herramienta diferida el modelo solo ve el
    // nombre y tiene que pedir el esquema, y lo que se quiere es justo que la
    // alcance sin pensarlo cuando le dices «crea una nota en mi mesa». El
    // esquema en el prompt cuesta unos cien tokens por sesión; que no acierte
    // cuesta que alguien edite a mano el fichero generado de la mesa.
    await $.tool.register({
      name: 'nota',
      isDeferred: false,
      description: [
        'Gestiona el post-it de este repositorio, el fichero NOTAS.md de su raíz,',
        'que el panel «Mi mesa» pinta arriba. Úsala cuando te pidan apuntar, añadir',
        'o quitar una nota, un recordatorio o un post-it «en mi mesa» o «en el panel».',
        'No edites NOTAS.md a mano con Write ni con Edit, y no toques nunca',
        'docs/MI-MESA.md: ese lo genera un guion y se reescribe entero.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['anadir', 'quitar', 'listar'],
            description: 'anadir una nota, quitar la que case con el texto, o listar las que hay',
          },
          texto: {
            type: 'string',
            description:
              'La nota, al añadir; parte de la nota que se quiere quitar, al quitar; se ignora al listar',
          },
        },
        required: ['accion'],
      },
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
   * Sirve la herramienta: una llamada que ningún hook contesta falla.
   *
   * `accion` viene validada por el esquema, pero el valor llega como lo mande
   * el modelo, así que se comprueba aquí: lo que no sea de los tres se trata
   * como `listar`, que es la operación que no escribe nada.
   *
   * El `result` es la frase pelada, no un `{ content: [...] }`: una herramienta
   * registrada por un mod no declara esquema de salida, y el que el núcleo le
   * pone por defecto admite `string`, lista de bloques o nada. Con el objeto,
   * la nota se escribía y la llamada contestaba error —`invalid_union`—, que es
   * el peor de los fallos posibles aquí: quien lo lee da por hecho que no se
   * guardó, repite la llamada y acaba con la nota duplicada.
   */
  on('tool.call', { tool: HERRAMIENTA }, async ($, e) => {
    const accion = e.accion === 'anadir' || e.accion === 'quitar' ? e.accion : 'listar'
    return { result: await nota($, accion, e.texto ?? '') }
  })

  on('command.run', { command: 'nota' }, async ($, e) => {
    const args = (e.args ?? '').trim()
    const quitar = /^--?quitar\s+/u.exec(args)
    if (quitar) return { text: await nota($, 'quitar', args.slice(quitar[0].length)) }
    // Sin argumentos no se escribe nada: se enseña lo que hay, que es lo que
    // un comando a medio teclear debe hacer en vez de añadir una nota vacía.
    return { text: await nota($, args ? 'anadir' : 'listar', args) }
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
    const { Box, Button, Text } = $.ui.resolve(e)
    const m = await read($, mesa)
    const ultimos = await read($, prompts)
    const post = await read($, notas)
    const reg = await read($, regen)
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
    // Cada nota ocupa las filas que necesite: se envuelve al ancho del panel en
    // lugar de recortarse. Una nota a medias —«pedir las claves de stagi…»—
    // obliga a abrir el fichero para leer lo que uno mismo dictó, que es justo
    // lo que el post-it viene a ahorrar.
    const envueltas = post.lines.slice(0, NOTAS_MAX).map(l => envolver(l, width - MARGEN))
    // Pero el post-it no se queda con el panel: con notas largas se para a la
    // mitad del cuerpo, y la nota que no entra entera no se pinta a medias,
    // se cuenta en el rótulo. Sin filas conocidas —un test, una superficie que
    // no manda las props— no hay tope y manda el número de notas.
    const techo = rows > 0 ? Math.max(1, Math.floor(rows / 2) - 1) : Infinity
    const pintadas: string[][] = []
    let alto = 0
    for (const nota of envueltas) {
      // La primera entra aunque pase del tope: una nota sola que no cupiera
      // dejaría el post-it en blanco teniendo algo escrito.
      if (pintadas.length > 0 && alto + nota.length > techo) break
      pintadas.push(nota)
      alto += nota.length
    }
    const restan = post.lines.length - pintadas.length
    const altoNotas = alto > 0 ? Math.min(alto, techo) + 1 : 0
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
            El rótulo dice en su sitio si el repositorio está versionando el
            fichero, que es el único aviso que llega a tiempo: el mod lo apunta
            en `.git/info/exclude` al leerlo, pero eso no saca de git lo que
            alguien commiteó antes, y lo que hay dentro son notas de una
            persona. Lleva la orden escrita para no tener que ir a buscarla.
            El rótulo es negro sobre amarillo, los dos colores dichos, y no
            `inverse` sobre amarillo: `inverse` pinta el texto del color del
            FONDO del tema, que en un tema claro es blanco, y blanco sobre
            amarillo no se lee. Negro sobre amarillo es el contraste del
            post-it de verdad, y el mismo en tema claro y en oscuro.
            Las notas van en `warning`, que es el ámbar del tema de quien lo
            usa y no un hex clavado aquí: resuelve a un amarillo que contrasta
            con el fondo del panel en tema claro y en oscuro, y un hex fijo se
            apagaría en uno de los dos. `yellow` a secas salía deslavado sobre
            el gris; en negritas, además, pesa lo que pesa una nota a mano. */}
        {altoNotas > 0 ? (
          <Box flexDirection="column" height={altoNotas} overflow="hidden" flexShrink={0}>
            <Text bold color="black" backgroundColor="yellow">
              {` NOTAS${restan > 0 ? ` · +${restan}` : ''}${post.enGit ? ' · SE SUBE A GIT: git rm --cached NOTAS.md' : ''} `.padEnd(
                width,
              )}
            </Text>
            {pintadas.map((nota, i) => (
              // La fila entera es el ámbito del hover: la equis se enciende
              // apuntando a cualquier parte de la nota y no solo al glifo, que
              // en un terminal es un blanco de un carácter.
              <Box key={`nota-${i}`} flexDirection="row">
                <Button
                  key={`quitar-${i}`}
                  plain
                  dimColor
                  label="×"
                  hover={{ color: 'red', bold: true }}
                  onPress={() => {
                    // Sin `await` y con el fallo tragado: lo que se dibuja no
                    // espera a un botón, y un post-it que no se deja escribir
                    // no puede tirar el panel. El ciclo de 15 s lo recupera.
                    void quitarPorNumero($, i, post.lines[i] ?? '').catch(() => {})
                  }}
                />
                <Text> </Text>
                <Box flexDirection="column">
                  {nota.map((l, j) => (
                    <Text key={`fila-${j}`} bold color="warning">
                      {l}
                    </Text>
                  ))}
                </Box>
              </Box>
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
          {/* La fecha de generación y, pegado a ella, el botón que la cambia:
              es el sitio que lo explica sin rótulo, y no la barra del título,
              donde la `inverse` de ancho completo no llega hasta el glifo y
              deja el botón flotando sobre el fondo del panel.
              Mientras corre no hay botón, hay texto: un control que se deja
              pulsar y no hace nada se pulsa tres veces, y el guion tarda. */}
          {/* La fila lleva clave porque es el ámbito del hover, como la de
              cada nota: la `↻` se enciende apuntando a cualquier parte de la
              línea de la fecha y no solo al glifo, que en un terminal es un
              blanco de un carácter. */}
          <Box key="cabecera" flexDirection="row">
            <Text dimColor>
              {`${total} tickets · ${m.hilos.length} hilos · generada ${m.generated}`}
            </Text>
            {reg.fase === 'corriendo' ? <Text color="cyan">{' · regenerando…'}</Text> : null}
            {reg.fase === 'quieto' && reg.guion !== undefined ? (
              <Button
                key="regenerar"
                plain
                dimColor
                label=" ↻"
                hover={{ color: 'cyan', bold: true }}
                onPress={() => {
                  // Sin `await` y con el fallo tragado, como la equis del
                  // post-it: lo que se dibuja no espera a un botón, y un guion
                  // que revienta no puede tirar el panel. Lo que pasó se lee en
                  // la línea de abajo.
                  void regenerar($).catch(() => {})
                }}
              />
            ) : null}
          </Box>
          {m.error ? <Text color="red">{cut(m.error, width)}</Text> : null}
          {reg.error ? <Text color="red">{cut(reg.error, width)}</Text> : null}
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
