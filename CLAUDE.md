# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Reglas generales

1. **Confirmar merge al terminar.** Al acabar cualquier tarea, preguntar siempre
   al usuario si hacemos el merge antes de fusionar la rama. Nunca mergear sin
   confirmación explícita.

2. **Cambios en Railway o Neon.** Si una tarea requiere modificar algo en Railway
   o en Neon (variables de entorno, base de datos, configuración del servicio,
   etc.), **resaltarlo claramente** y entregar la instrucción exacta, lista para
   copiar y pegar (comando, valor o paso a paso preciso), de modo que el usuario
   solo tenga que copiarla y aplicarla.

3. **La rama de deploy es `main`.** TODO merge debe ir a `main`, que es la única
   rama que dispara el deploy. **No fusionar nunca en `claude/document-management-app-OPSKb`**
   ni en ninguna otra rama, aunque Git reporte otra rama como la rama por defecto
   (`HEAD branch`) del repositorio. Al confirmar un merge con el usuario, el destino
   siempre es `main`.
