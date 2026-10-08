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

declare module 'claude-code' {
  interface PluginState {
    'mi-mesa': { mesa: Mesa; prompts: Prompt[] }
  }
}
