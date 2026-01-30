# Fast Resoluciones

Sistema web para extraer automáticamente **Usuario** e **Identificación** desde documentos PDF de resoluciones y completar archivos Excel.

## Características

- **Extracción basada en sección RESUELVE**: Busca la sección "RESUELVE" del documento donde aparece "a favor de [nombre]" con la identificación
- **Búsqueda inteligente**: Primero intenta con texto embebido, luego OCR si es necesario
- **Procesamiento masivo**: Procesa cientos de resoluciones en minutos
- **Tres modos de operación**: Principal, Prueba y Verificación
- **Reportes detallados**: Genera dos archivos TXT - reporte principal y estadísticas de páginas RESUELVE
- **Funciona offline**: Todo se procesa en el navegador, sin enviar datos a servidores externos

---

## Cómo Funciona la Extracción

El sistema busca los datos siguiendo esta lógica:

1. **Busca la sección "RESUELVE:"** en el documento
2. **Dentro de RESUELVE**, busca el patrón:
   ```
   "a favor de [el/la señor/a] NOMBRE, identificad@ con cédula/NIT No. NÚMERO"
   ```
3. **La sección RESUELVE puede estar en cualquier página** (3, 4, 5, 6, 7...)
4. Primero intenta con texto embebido (rápido), si no encuentra usa OCR

### Ejemplo de texto que extrae:

```
ARTÍCULO PRIMERO: Otorgar Permiso... a favor de la señora TAKIS PANQUEVA ARENAS 
DE LA ROSA, identificada con cédula de ciudadanía No. 1.031.140.199...
```

Extrae:
- **Usuario**: Takis Panqueva Arenas De La Rosa
- **Identificación**: 1031140199

---

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/fast-resoluciones.git
cd fast-resoluciones

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

Abre **http://localhost:5173/** en tu navegador.

---

## Guía de Uso

### Modo Principal (Pestaña "Principal")

Este es el modo principal para procesar un Excel completo con sus PDFs correspondientes.

#### Paso 1: Preparar el Excel

Tu archivo Excel debe tener las siguientes columnas:

- **Resolución**: Número de la resolución (ej: `176`, `1234`, `3588`)
- **Usuario**: Columna donde se escribirá el nombre extraído (puede estar vacía)
- **Identificacion**: Columna donde se escribirá la cédula extraída (puede estar vacía)

> **Nota**: Las filas que ya tengan datos en Usuario e Identificacion serán ignoradas automáticamente.

#### Paso 2: Preparar los PDFs

Los archivos PDF deben seguir el formato de nombre:

```
RS-[NÚMERO 4 DÍGITOS]-[DÍA]-[MES]-[AÑO].pdf
```

**El número siempre debe tener 4 dígitos** (con ceros a la izquierda si es necesario):

| Excel tiene | PDF debe llamarse           |
| ----------- | --------------------------- |
| 97          | `RS-0097-23-JULIO-2025.pdf` |
| 176         | `RS-0176-01-ENERO-2025.pdf` |
| 1234        | `RS-1234-15-MARZO-2025.pdf` |
| 3588        | `RS-3588-23-JULIO-2025.pdf` |

**Ejemplos:**

- `RS-0097-23-JULIO-2025.pdf` ← para resolución 97
- `RS-0176-01-ENERO-2025.pdf` ← para resolución 176
- `RS-3588-23-JULIO-2025.pdf` ← para resolución 3588
- `RS-4293-08-SEPTIEMBRE-2025.pdf` ← para resolución 4293

> **Importante**: Solo se procesan archivos que comiencen con `RS-`. El sistema busca automáticamente con el número paddeado a 4 dígitos.

#### Paso 3: Cargar archivos

1. **Arrastra el Excel** a la zona "Archivo Excel" o haz clic para seleccionarlo
2. **Arrastra los PDFs** a la zona "Archivos PDF" o haz clic para seleccionarlos
   - Puedes agregar PDFs en múltiples lotes (se acumulan)
   - Usa "Limpiar todo" para eliminar todos los PDFs cargados

#### Paso 4: Procesar

1. Haz clic en **"Procesar y Descargar"**
2. Espera mientras se procesan los archivos (verás una barra de progreso)
3. Al finalizar:
   - Se descargará automáticamente el **Excel completado** (`resoluciones_completadas.xlsx`)
   - Se descargará un **reporte TXT** (`reporte_resoluciones.txt`) con el detalle
   - Se descargará un **reporte de estadísticas RESUELVE** (`estadisticas_resuelve.txt`)

#### Interpretar el registro

| Color       | Significado                                                    |
| ----------- | -------------------------------------------------------------- |
| 🟢 Verde    | Éxito - Datos extraídos con alta confianza                     |
| 🔵 Azul     | A revisar - Datos extraídos pero requieren verificación manual |
| 🟣 Morado   | Parcial - Solo se encontró nombre o cédula, no ambos           |
| 🟡 Amarillo | Sin PDF - No se encontró archivo PDF para esa resolución       |
| 🔴 Rojo     | Error - No se pudo extraer ningún dato del PDF                 |

---

### Modo Prueba (Pestaña "Prueba")

Permite probar la extracción con un solo PDF antes de procesar en lote.

1. Arrastra o selecciona **un PDF**
2. Haz clic en **"Probar extracción"**
3. Verás:
   - El nombre y cédula extraídos (si se encontraron)
   - La página donde se encontró la sección RESUELVE
   - El texto extraído para análisis
4. Opcionalmente descarga un Excel de prueba con los datos

**Útil para:**

- Verificar que un PDF específico se procesa correctamente
- Diagnosticar problemas de extracción
- Ver en qué página está la sección RESUELVE

---

### Modo Verificación (Pestaña "Verificación")

Compara los datos de un Excel ya completado contra los PDFs originales.

1. Carga el **Excel completado** (con datos en Usuario e Identificacion)
2. Carga los **PDFs correspondientes**
3. Haz clic en **"Verificar datos"**
4. El sistema comparará:
   - Datos en el Excel vs datos extraídos de los PDFs
   - Mostrará diferencias encontradas

**Útil para:**

- Auditar datos existentes
- Encontrar errores en llenado manual previo
- Validar la precisión del sistema

---

## Formato del Excel de Salida

El Excel completado tendrá las columnas Usuario e Identificacion con formato:

```
Usuario: "Juan Pérez García [OCR (pág 5)]"
Identificacion: "12345678"
```

El texto entre corchetes indica la fuente:

- `[OCR (pág X)]` - Extraído mediante OCR de la página X
- `[EMBED (pág X)]` - Extraído del texto embebido de la página X
- El número de página indica dónde se encontró la sección RESUELVE

---

## Reportes Generados

### 1. Reporte Principal (`reporte_resoluciones.txt`)

Incluye:

1. **Resumen**: Totales de éxitos, revisiones, parciales, errores y sin archivo
2. **Exitosos**: Lista de resoluciones procesadas correctamente
3. **A Revisar**: Resoluciones con datos pero baja confianza
4. **Parciales**: Resoluciones donde solo se encontró nombre o cédula
5. **Sin RESUELVE**: Resoluciones donde no se encontró la sección RESUELVE
6. **Errores**: Resoluciones donde no se pudo extraer nada
7. **Sin Archivo**: Resoluciones del Excel que no tienen PDF correspondiente

### 2. Estadísticas RESUELVE (`estadisticas_resuelve.txt`)

Incluye:

1. **Resumen por método**: Cuántos se encontraron en EMBED vs OCR
2. **Distribución por página**: En qué páginas aparece la sección RESUELVE
3. **Archivos sin RESUELVE**: Lista de archivos donde no se encontró la sección
4. **Detalle completo**: Tabla con cada archivo, página y método usado

**Útil para:**
- Optimizar futuros procesamientos conociendo el rango de páginas típico
- Identificar archivos con formato diferente

---

## Solución de Problemas

### "No se encontró archivo PDF"

- Verifica que el nombre del PDF comience con `RS-`
- **El número debe tener 4 dígitos** con ceros a la izquierda
- Ejemplos de búsqueda:
  - Resolución `97` → busca `RS-0097-*.pdf`
  - Resolución `176` → busca `RS-0176-*.pdf`
  - Resolución `3588` → busca `RS-3588-*.pdf`

### "No se encontró la sección RESUELVE"

- El PDF puede tener un formato diferente al esperado
- Verifica que el documento contenga la palabra "RESUELVE:"
- Usa el modo Prueba para ver el texto extraído

### "No se encontró 'a favor de'"

- La sección RESUELVE se encontró pero no tiene el patrón esperado
- El documento puede usar un formato diferente (ej: empresas vs personas naturales)
- Verifica manualmente el contenido del PDF

### "Datos extraídos incorrectos"

- Si aparece `[REVISAR]`, verifica manualmente el dato
- Compara con el texto mostrado en los detalles del log

### El procesamiento es muy lento

- La búsqueda de RESUELVE puede requerir revisar varias páginas con OCR
- PDFs con texto embebido se procesan más rápido
- El reporte de estadísticas te ayudará a entender el rendimiento

---

## Tecnologías

- **React 19** - Interfaz de usuario
- **Vite** - Bundler y servidor de desarrollo
- **TypeScript** - Tipado estático
- **Tesseract.js** - OCR en el navegador
- **PDF.js** - Lectura de PDFs
- **SheetJS (xlsx)** - Lectura/escritura de Excel

---

## Privacidad

Todos los archivos se procesan **localmente en tu navegador**. Ningún dato se envía a servidores externos. Puedes verificar esto en las herramientas de desarrollador del navegador (pestaña Network).

---

## Licencia

MIT License - Uso libre para cualquier propósito.
