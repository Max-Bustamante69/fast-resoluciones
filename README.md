# Fast Resoluciones

Sistema web para extraer automáticamente **Usuario** e **Identificación** desde documentos PDF de resoluciones y completar archivos Excel.

## Características

- **Extracción automática**: Usa OCR (Tesseract.js) y texto embebido para extraer datos de PDFs
- **Procesamiento masivo**: Procesa cientos de resoluciones en minutos
- **Tres modos de operación**: Principal, Prueba y Verificación
- **Reportes detallados**: Genera un archivo TXT con el resultado completo del procesamiento
- **Funciona offline**: Todo se procesa en el navegador, sin enviar datos a servidores externos

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
RS-[NÚMERO]-[DÍA]-[MES]-[AÑO].pdf
```

**Ejemplos válidos:**

- `RS-3588-23-JULIO-2025.pdf`
- `RS-176-01-ENERO-2025.pdf`
- `RS-4293-08-SEPTIEMBRE-2025.pdf`

> **Importante**: Solo se procesan archivos que comiencen con `RS-`. Otros archivos serán ignorados.

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
   - El texto OCR y texto embebido para comparar
4. Opcionalmente descarga un Excel de prueba con los datos

**Útil para:**

- Verificar que un PDF específico se procesa correctamente
- Diagnosticar problemas de extracción
- Entender por qué un PDF no extrae datos

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
Usuario: "Juan Pérez García [OCR]"
Identificacion: "12345678"
```

El texto entre corchetes indica la fuente:

- `[OCR]` - Extraído mediante reconocimiento óptico
- `[EMBED]` - Extraído del texto embebido en el PDF
- `[OCR+EMBED]` - Combinación de ambos métodos
- `[REVISAR]` - El dato requiere verificación manual

---

## Formato del Reporte TXT

El archivo `reporte_resoluciones.txt` incluye:

1. **Resumen**: Totales de éxitos, revisiones, parciales, errores y sin archivo
2. **Exitosos**: Lista de resoluciones procesadas correctamente
3. **A Revisar**: Resoluciones con datos pero baja confianza
4. **Parciales**: Resoluciones donde solo se encontró nombre o cédula
5. **Errores**: Resoluciones donde no se pudo extraer nada
6. **Sin Archivo**: Resoluciones del Excel que no tienen PDF correspondiente

---

## Solución de Problemas

### "No se encontró archivo PDF"

- Verifica que el nombre del PDF comience con `RS-`
- Verifica que el número de resolución coincida
- Ejemplo: Resolución `3588` busca archivos como `RS-3588-*.pdf`

### "No se encontró señor/a ni cédula"

- El PDF puede tener un formato diferente al esperado
- Usa el modo Prueba para ver el texto extraído
- Algunos PDFs escaneados con baja calidad pueden fallar

### "Datos extraídos incorrectos"

- Si aparece `[REVISAR]`, verifica manualmente el dato
- Compara con el texto mostrado en los detalles del log

### El procesamiento es muy lento

- Los PDFs escaneados requieren OCR, que toma ~5-10 segundos por archivo
- PDFs con texto embebido se procesan instantáneamente
- El sistema procesa solo la primera página de cada PDF

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
