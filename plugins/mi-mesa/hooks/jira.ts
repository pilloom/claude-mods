/**
 * El cliente de Jira del generador del mod, sobre la red del host.
 *
 * Recibe la función de `fetch` y no `$` entero: así `generador.ts` se prueba con
 * un cliente falso y esto, con un `fetch` falso, sin montar el motor.
 *
 * Solo Jira Cloud (API v3): `search/jql` con `nextPageToken`, que es el que la
 * nube mantiene desde que retiró el `search` de siempre, y el campo Team, que
 * es de Atlassian Cloud. Las tres formas se comprobaron contra una instancia de
 * verdad antes de escribir esto.
 */
import type { Cliente, ConfigJira, Issue } from './generador'

/** Lo que este cliente usa de `$.http.fetch`. */
export type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text: string }>

/** El tipo del campo Team de Atlassian, que es lo que lo encuentra en cualquier instancia. */
const TIPO_TEAM = 'com.atlassian.jira.plugin.system.customfieldtypes:atlassian-team'
/** Tope de páginas por consulta: 50 × 100 issues, de sobra para una mesa o un Team. */
const PAGINAS = 50

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Base64 de un texto en UTF-8, a mano.
 *
 * El módulo de hooks no tiene Node ni DOM, así que no se puede contar con
 * `btoa` ni con `Buffer`. Un correo o un token con algo fuera de ASCII tiene
 * que llegar igual a Jira, así que primero se pasa a bytes UTF-8.
 */
export function base64(texto: string): string {
  const bytes: number[] = []
  for (const ch of texto) {
    const p = ch.codePointAt(0) ?? 0
    if (p < 0x80) bytes.push(p)
    else if (p < 0x800) bytes.push(0xc0 | (p >> 6), 0x80 | (p & 63))
    else if (p < 0x10000) bytes.push(0xe0 | (p >> 12), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63))
    else bytes.push(0xf0 | (p >> 18), 0x80 | ((p >> 12) & 63), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63))
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]
    out += B64[(n >> 12) & 63]
    out += b === undefined ? '=' : B64[(n >> 6) & 63]
    out += c === undefined ? '=' : B64[n & 63]
  }
  return out
}

/**
 * Lo que dice un código de error, en una frase que diga qué tocar.
 *
 * Lo que sale de aquí acaba en la línea roja del panel: «401» a secas no dice
 * que el token esté mal, y es casi siempre eso.
 */
export function explicar(status: number, cuerpo: string, que: string): string {
  if (status === 401) return 'Jira no acepta el correo y el token de /config (401): revisa los dos'
  if (status === 403) return `Jira no te deja ${que} (403): la cuenta no tiene permiso`
  if (status === 404) return `Jira no encuentra ${que} (404): revisa la URL de /config`
  let detalle = ''
  try {
    const j = JSON.parse(cuerpo) as { errorMessages?: unknown; errors?: unknown }
    const msgs = Array.isArray(j.errorMessages) ? j.errorMessages : []
    detalle = [...msgs, ...Object.values((j.errors ?? {}) as Record<string, unknown>)].map(String).join(' · ')
  } catch {
    // Un cuerpo que no es JSON —una página de error— no aporta nada legible.
  }
  return `Jira contestó ${status} al ${que}${detalle ? `: ${detalle}` : ''}`
}

/** El cliente que usa `generar`, con las credenciales de `/config`. */
export function clienteJira(fetch: Fetch, cfg: ConfigJira): Cliente {
  const base = cfg.url.replace(/\/+$/u, '')
  const headers = {
    Authorization: `Basic ${base64(`${cfg.email}:${cfg.token}`)}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const pedir = async (ruta: string, que: string, body?: unknown): Promise<unknown> => {
    const r = await fetch(`${base}${ruta}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!r.ok) throw new Error(explicar(r.status, r.text, que))
    try {
      return JSON.parse(r.text) as unknown
    } catch {
      throw new Error(`Jira no devolvió JSON al ${que}: ¿la URL es la de la instancia?`)
    }
  }

  return {
    async yo() {
      const j = (await pedir('/rest/api/3/myself', 'leer tu cuenta')) as {
        accountId?: unknown
        displayName?: unknown
      }
      if (typeof j.accountId !== 'string' || !j.accountId) throw new Error('Jira no dijo quién eres')
      return { accountId: j.accountId, displayName: typeof j.displayName === 'string' ? j.displayName : '' }
    },

    async campoTeam() {
      const campos = (await pedir('/rest/api/3/field', 'listar los campos')) as {
        schema?: { custom?: unknown; customId?: unknown }
      }[]
      if (!Array.isArray(campos)) return undefined
      const team = campos.find(c => c.schema?.custom === TIPO_TEAM)
      return typeof team?.schema?.customId === 'number' ? team.schema.customId : undefined
    },

    async buscar(jql, campos) {
      const todos: Issue[] = []
      let token: string | undefined
      for (let p = 0; p < PAGINAS; p++) {
        const j = (await pedir('/rest/api/3/search/jql', 'buscar tickets', {
          jql,
          fields: campos,
          maxResults: 100,
          ...(token ? { nextPageToken: token } : {}),
        })) as { issues?: Issue[]; nextPageToken?: unknown; isLast?: unknown }
        todos.push(...(j.issues ?? []))
        token = typeof j.nextPageToken === 'string' ? j.nextPageToken : undefined
        if (j.isLast === true || !token) return todos
      }
      // Cortar en silencio sería contar de menos sin decirlo.
      throw new Error(`La consulta trae más de ${PAGINAS * 100} tickets: acota el proyecto con un Team`)
    },
  }
}
