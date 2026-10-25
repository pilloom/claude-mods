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
    'mi-mesa': { mesa: Mesa; prompts: Prompt[]; notas: Notas }
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
