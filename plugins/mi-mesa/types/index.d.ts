export type Ticket = {
  mark: string
  key: string
  priority: string
  /**
   * De qué tipo es, ya como emoji: `🐞` error, `✅` tarea o subtarea, `📖`
   * historia, `❔` un tipo que el guion no conoce.
   *
   * Lo trae **tal cual** lo escribió la mesa, sin traducir nada aquí: el panel
   * pinta el emoji que haya, así que un repositorio que mañana use otro no
   * obliga a tocar el mod. Y solo lo trae la mesa cuya columna existe: los
   * guiones generadores se portan de uno en uno.
   */
  tipo?: string
  summary: string
  otherThreads: string
  /** Quién lo tiene, si no eres tú. Solo lo trae la mesa que escribe esa columna. */
  owner?: string
}
export type Hilo = { title: string; tickets: Ticket[] }
export type Mesa = {
  repo: string
  generated: string
  hilos: Hilo[]
  mtimeMs: number
  error?: string
  /**
   * El guion que escribió el fichero, como su cabecera lo nombra: la ruta
   * relativa del `listar-mi-mesa` de ese repositorio. Solo lo trae la mesa
   * cuya cabecera lo diga, y de ahí sale el comando del botón de regenerar.
   */
  generador?: string
  /**
   * El marcador de la semana, si el guion de ese repositorio lo escribe.
   *
   * Va en la mesa y no en un fichero aparte porque es la misma consulta y el
   * mismo guion: el fichero ya cuenta cosas del Team entero —los abiertos sin
   * asignar, las épicas— en «Lo que NO está aquí», así que un marcador del
   * Team no le cambia la naturaleza al fichero ni obliga a generar dos.
   */
  pulso?: Pulso
}

/**
 * Lo que el botón de regenerar la mesa necesita saber entre dibujados.
 *
 * Va en su propio atom y no dentro de `Mesa` porque `refresh` reemplaza esa
 * entera cada vez que el fichero cambia, y lo que hay aquí tiene que
 * sobrevivir justo a eso: al redibujado de después de regenerar.
 */
export type Regen = {
  /**
   * En qué está: `quieto` es el botón puesto, `preguntando` es la confirmación
   * abierta y `corriendo`, el guion en marcha.
   *
   * Un solo campo y no dos banderas: las tres fases se excluyen, y con
   * `preguntando` y `corriendo` por separado existiría el estado imposible de
   * estar en las dos. Mientras no esté `quieto` no se lanza nada más: dos
   * pulsaciones no abren dos diálogos ni corren dos guiones.
   */
  fase: 'quieto' | 'preguntando' | 'corriendo'
  /**
   * La ruta relativa del guion que se ejecutaría, ya resuelta y comprobada en
   * disco. Sin ella no hay botón: un repositorio sin guion no gana un control
   * que no puede hacer nada.
   */
  guion?: string
  /** Lo que falló la última vez, para decirlo donde se dice el de la mesa. */
  error?: string
}

/** Un mensaje que escribiste tú, tal como lo guarda ~/.claude/history.jsonl. */
export type Prompt = {
  /** El texto en una línea: lo que se teclea con saltos se junta con espacios. */
  text: string
  /** Milisegundos desde la época, para ordenar y para la hora que pinta el panel. */
  at: number
}

/**
 * El post-it: lo que hay escrito en NOTAS.md, ya limpio de adornos.
 *
 * Sin notas la lista va vacía y `mtimeMs` a 0, que es también lo que vale
 * cuando el fichero no existe: el panel omite la sección entera en los dos
 * casos y no deja un hueco con el rótulo solo.
 */
export type Notas = {
  lines: string[]
  mtimeMs: number
  /**
   * El post-it está siendo versionado por el repositorio, que es justo lo que
   * no debe pasar: son notas de una persona. Solo lo sabe el repositorio donde
   * alguien lo commiteó antes de que el mod lo apuntara en `.git/info/exclude`,
   * y el panel lo avisa en el rótulo porque de ahí no se sale solo.
   */
  enGit?: boolean
}

/** Lo que la herramienta del mod recibe; `accion` la valida su esquema. */
export type NotaInput = {
  accion?: 'anadir' | 'quitar' | 'listar'
  texto?: string
}

/**
 * El marcador de la semana: lo que entra contra lo que sale.
 *
 * Es **flujo, no existencias**: `abren` son los tickets *creados* en el tramo
 * y `cierran` los *cerrados* en ese mismo tramo, no los que hay abiertos ahora
 * mismo —que es lo que cuenta la mesa de arriba—. De los dos juntos sale lo
 * único que contesta «¿vamos ganando?»: si se cierra más de lo que entra.
 *
 * Son cifras del **Team entero y sin nombres**: la comparación motiva, la lista
 * de quién va último señala. Lo tuyo sale aparte (`tuyos`) y tu sitio en la
 * tabla como un número (`puesto` de `personas`), que es lo que te dice si subes
 * sin decirle a nadie quién está debajo.
 *
 * Lo escribe el guion generador de cada repositorio, como todo lo que el panel
 * pinta, y **todo es opcional menos `abren` y `cierran`**: una mesa cuyo guion
 * todavía no escriba la sección no gana un marcador en blanco, se pinta como
 * siempre. La misma regla que la columna del tipo y la de quién lo tiene.
 */
export type Pulso = {
  /** Tickets creados en el tramo. */
  abren: number
  /**
   * Tickets cerrados en el tramo, **sin contar subtareas**.
   *
   * Sin esa resta el marcador premia a quien desglosa: en LAN, 9 de cada 10
   * cierres recientes son subtareas de una misma persona, y un tablero que se
   * ve enseña rápido a partir el trabajo en nueve trozos. Las subtareas no se
   * esconden —van en `subtareas`, a su lado—, pero no entran en la cuenta que
   * compara.
   */
  cierran: number
  /**
   * Subtareas cerradas en el tramo.
   *
   * 🔴 **Se lee y no se pinta.** Siguen fuera de `abren` y de `cierran`
   * —contarlas premia a quien desglosa— y la mesa las cuenta para quien abra el
   * fichero, pero en la fila del panel eran un tercer número que había que
   * explicar cada vez, y la fila existe justamente para no tener que explicar
   * nada. Si vuelven, el sitio es `trozosDePulso`.
   */
  subtareas?: number
  /** Los que cerraste tú, con el mismo criterio que `cierran`. */
  tuyos?: number
  /** Tu sitio en la tabla de cierres del Team, 1 el primero. */
  puesto?: number
  /** Entre cuántas personas, para que el puesto signifique algo. */
  personas?: number
  /**
   * Qué tramo cuentan las cifras, **como la mesa lo nombre**: `MAR-LUN` la
   * semana entera, `MAR-JUE` un jueves por la tarde.
   *
   * La semana va de **martes a lunes**, porque el lunes es el día de las
   * revisiones: lo que se cierra ese día es la cosecha de la semana que acaba,
   * no el arranque de la siguiente. Quién sabe por dónde va es el guion que
   * consultó Jira, no quien dibuja: el panel lo pinta tal cual, sin calendario
   * propio —y por eso cambiar el día en que abre la semana no toca el mod—. Lo
   * que no hace el guion es fiarse del `startOfWeek()` de Jira: el primer día
   * de la semana es un ajuste de la instancia, ninguna instancia abre en
   * martes, y el día que alguien lo moviera el tramo entero se correría sin que
   * nada lo delate.
   */
  tramo?: string
}

declare module 'claude-code' {
  interface PluginState {
    'mi-mesa': { mesa: Mesa; prompts: Prompt[]; notas: Notas; regen: Regen; vista: number }
  }
  /**
   * La herramienta que el mod registra en marcha, declarada aquí porque los
   * tipos que escribe el motor solo conocen las herramientas de la build y las
   * de los servidores MCP conectados: la de un mod no está en ninguna de las
   * dos listas, y sin esto el matcher de `tool.call` no la admite.
   */
  interface McpToolInputs {
    'mcp__mi-mesa__nota': NotaInput
  }
}
