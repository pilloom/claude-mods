export type Ticket = {
  mark: string
  key: string
  priority: string
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

declare module 'claude-code' {
  interface PluginState {
    'mi-mesa': { mesa: Mesa; prompts: Prompt[]; notas: Notas; regen: Regen }
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
