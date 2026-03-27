# WhatsApp Masivo

Script de Node.js para enviar mensajes de WhatsApp a una lista de contactos desde un archivo Excel. Diseñado para envíos de hasta ~100 mensajes por día con mecanismos anti-detección: delays aleatorios entre mensajes, pausas largas y envío restringido al horario configurado.

## Stack
- **Node.js 18+**
- **whatsapp-web.js** — automatiza WhatsApp Web
- **Puppeteer** — controla Chrome en segundo plano
- **xlsx** — lectura de archivos Excel
- **luxon** — manejo de timezone (Lima, Perú)

---

## Requisitos

- [Node.js 18 o superior](https://nodejs.org/)
- Una cuenta de WhatsApp activa en el celular
- Un archivo Excel (`.xlsx`) con los números de teléfono

---

## Instalación

```bash
npm install
```

> La primera instalación descarga Chromium (~170 MB), que es el navegador que usa el script internamente. En Windows puede tardar varios minutos. Si falla, prueba desactivando el antivirus temporalmente o ejecutando la terminal como administrador.

---

## Configuración

Antes de usar el script, revisa y ajusta estos tres archivos:

### 1. `config.json`

Controla qué archivo Excel usar, qué columnas leer y el horario de envío.

```json
{
  "excel": {
    "file": "prueba.xlsx",
    "sheet": 0,
    "phoneColumn": 0,
    "nameColumn": 1,
    "hasHeader": true
  },
  "schedule": {
    "startHour": 8,
    "endHour": 20,
    "timezone": "America/Lima"
  },
  "delays": {
    "minBetweenMessages": 2000,
    "maxBetweenMessages": 5000,
    "pauseEvery": { "min": 10, "max": 15 },
    "pauseDuration": { "min": 30000, "max": 60000 }
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `excel.file` | Nombre del archivo Excel (debe estar en la raíz del proyecto) |
| `excel.sheet` | Número de hoja a leer (0 = primera hoja) |
| `excel.phoneColumn` | Columna con los teléfonos (0 = columna A, 1 = columna B, etc.) |
| `excel.nameColumn` | Columna con los nombres. Usa `-1` si no hay columna de nombres |
| `excel.hasHeader` | `true` si la primera fila es encabezado (se omite al leer) |
| `schedule.startHour` / `endHour` | Horario permitido para enviar (8 y 20 = de 8am a 8pm) |
| `schedule.timezone` | Zona horaria para el horario de envío |
| `delays.*` | Tiempos de espera entre mensajes y pausas periódicas (en milisegundos) |

### 2. `message.txt`

Escribe aquí el mensaje que se va a enviar. Puedes usar `{nombre}` para personalizarlo con el nombre de cada contacto:

```
Hola {nombre}, te escribo para informarte sobre...
Saludos,
Angelica
```

Si un contacto no tiene nombre en el Excel, `{nombre}` se reemplaza por una cadena vacía automáticamente.

### 3. Excel de contactos

Coloca tu archivo Excel en la raíz del proyecto (junto a `index.js`). El nombre debe coincidir con el valor de `excel.file` en `config.json`.

**Formato esperado:**
- Los números deben estar en formato peruano con prefijo de país: `51987654321`
- El script solo acepta números móviles peruanos (prefijo `51`)
- Se recomienda que la primera fila sea encabezado (`hasHeader: true`)

Ejemplo de estructura:

| telefono | nombre |
|----------|--------|
| 51987654321 | Maria |
| 51912345678 | Carlos |

---

## Uso

### Primera vez: escanear el QR

La primera vez que ejecutas el script, aparece un código QR en la consola. Debes escanearlo con WhatsApp:

1. Abre WhatsApp en tu celular
2. Ve a **Dispositivos vinculados** → **Vincular dispositivo**
3. Apunta la cámara al QR que aparece en la consola

La sesión queda guardada en la carpeta `.wwebjs_auth/`. Las siguientes veces que ejecutes el script, no necesitas escanear de nuevo.

### Comandos

```bash
# Envío normal — inicia o reanuda desde donde quedó
node index.js

# Ver estado sin enviar nada (no conecta a WhatsApp)
node index.js --dry-run

# Probar con un número específico antes de enviar a todos
node index.js --test 51987654321

# Reintentar solo los números que fallaron anteriormente
node index.js --retry
```

| Comando | Descripción |
|---------|-------------|
| `node index.js` | Inicia el envío. Si ya hubo envíos previos, retoma desde el último contacto procesado |
| `--dry-run` | Muestra cuántos contactos hay, cuáles ya se procesaron y cuáles faltan, sin enviar nada |
| `--test <numero>` | Envía el mensaje a un número específico para verificar que todo funciona antes de hacer el envío masivo |
| `--retry` | Reintenta enviar a los números que fallaron (los que están en `data/failed.json`) |

**Nota sobre el horario:** si ejecutas el script fuera del horario configurado (por defecto 8am–8pm hora Lima), el script espera automáticamente hasta que sea la hora permitida.

---

## Archivos generados automáticamente

El script crea y actualiza estos archivos de forma automática:

| Archivo | Descripción |
|---------|-------------|
| `data/state.json` | Guarda el progreso: índice del último contacto procesado. Permite reanudar si el script se interrumpe |
| `data/failed.json` | Lista de números que no se pudieron enviar. Usa `--retry` para reintentarlos |
| `.wwebjs_auth/` | Carpeta con la sesión de WhatsApp guardada. No la elimines si no quieres volver a escanear el QR |

---

## Solución de problemas

**El QR no aparece o tarda demasiado**
- Cierra y vuelve a ejecutar el script
- Ejecutar la terminal como administrador

**El script dice que está fuera de horario y no envía**
- Revisa `schedule.startHour` y `schedule.endHour` en `config.json`
- La zona horaria está configurada como `America/Lima`; si usas el script en otro país, ajusta ese campo

**Error al leer el Excel**
- Verifica que el nombre del archivo en `config.json` coincide exactamente con el archivo en la carpeta (incluyendo mayúsculas y extensión)
- Asegúrate de que los números en el Excel tienen el prefijo `51` (ejemplo: `51987654321`, no `987654321`)
- Confirma que `phoneColumn` y `nameColumn` apuntan a las columnas correctas (la columna A es el índice `0`)

**Mensajes fallidos / `data/failed.json` tiene números**
- Algunos números pueden fallar si no tienen WhatsApp activo o si hay un problema temporal de conexión
- Ejecuta `node index.js --retry` para reintentarlos
- Si un número falla repetidamente, probablemente no tiene WhatsApp

**La sesión se cerró y pide QR de nuevo**
- Esto ocurre si WhatsApp cerró la sesión desde el celular o si eliminaste la carpeta `.wwebjs_auth/`
- Simplemente escanea el QR nuevamente

