# claude-mods

Los mods de Claude Code de RBSistemas. Este repositorio **es** el marketplace:
se añade una vez y de ahí salen todos los mods, los de hoy y los que vengan.

## Instalar

En el prompt de una sesión de terminal:

```
/plugin install mi-mesa --marketplace pilloom/claude-mods
```

Lo que verás, en orden: `Add marketplace?` nombrando `github:pilloom/claude-mods`,
que se responde `y`; luego los detalles del plugin, con el ámbito **user** el
primero, que se toma con Enter; y al final `Installed mi-mesa. Plugin is now
active.` Desde ese momento corre en esa sesión, sin reiniciar, y en todas las que
abras después.

⚠️ Es una línea de **terminal**: en la pestaña Code de la app de escritorio el
comando contesta que no está disponible ahí. Un mod instalado desde el terminal
en el ámbito user sí carga en esa sesión local, y dibuja igual.

El repositorio es privado: hace falta que tu `git` tenga acceso a `pilloom`.

## Los mods

| Mod | Qué hace |
|-----|----------|
| [`mi-mesa`](plugins/mi-mesa/) | Un panel con el post-it de `NOTAS.md`, tus tickets abiertos agrupados por hilo y los últimos mensajes que le pasaste a Claude Code; y un sonido al acabar el turno. |

## Añadir un mod nuevo

Su carpeta va en `plugins/<nombre>/` y su entrada en
`.claude-plugin/marketplace.json`. Quien ya tenga el marketplace añadido no
tiene que volver a añadirlo: le basta con instalar el nuevo por su nombre.

Antes de subir nada, los tres comandos que leen lo mismo que lee el motor:

```bash
claude plugin validate plugins/<nombre>   # manifiesto, marketplace y módulo
claude plugin test     plugins/<nombre>   # los *.test.ts contra el motor
pnpm exec tsc -p       plugins/<nombre>   # los tipos (ver el README del mod)
```
