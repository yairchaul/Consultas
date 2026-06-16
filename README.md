# Consultas
# 📍 Buscador de Centros de Trabajo

Aplicación web que permite buscar centros de trabajo (escuelas) por nombre o CCT, mostrando su ubicación en un mapa interactivo y todos los datos relevantes.

## 🚀 Demo

Visita el sitio en vivo: [https://yairchaul.github.io/Consultas/](https://yairchaul.github.io/Consultas/)

## 📋 Características

- 🔍 **Búsqueda en tiempo real** por nombre del centro o CCT
- 🗺️ **Mapa interactivo** con marcadores para cada escuela
- 📞 **Teléfonos clicables** (llamada directa desde el celular)
- 📱 **Diseño responsive** optimizado para móviles
- 📊 **Información completa** de cada centro (equipos, enlaces, dirección)
- 🏷️ **Filtro automático** mientras escribes

## 🛠️ Tecnologías

- **HTML5** - Estructura de la aplicación
- **CSS3** - Estilos y diseño responsive
- **JavaScript (ES6+)** - Lógica de la aplicación
- **Leaflet.js** - Mapas interactivos
- **Google Sheets API** - Base de datos en la nube

## 📦 Estructura del proyecto
├── index.html # Página principal
├── style.css # Estilos (incluido en el HTML)
└── README.md # Documentación

text

## 🗄️ Base de datos

Los datos se obtienen desde una hoja de Google Sheets pública con la siguiente estructura:

| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | Núm | Número de registro |
| B | CCT | Clave del Centro de Trabajo |
| C | Nombre del CCT | Nombre completo del centro |
| D | Calle y número | Dirección |
| E | Colonia | Colonia |
| F | Alcaldía | Alcaldía o delegación |
| G | C. P. | Código Postal |
| H | Entre calles | Calles entre las que se ubica |
| I | Día de entrega | Fecha de entrega |
| J | Cantidad de Equipos de Escritorio Requeridos | Número de equipos de escritorio |
| K | Cantidad de Equipos Laptop Requeridos | Número de laptops |
| L | Cantidad de Equipos Laptop alto desempeño requeridos | Número de laptops de alto desempeño |
| M | Total de equipos | Suma total de equipos |
| N | Unidad de adscripción | Unidad a la que pertenece |
| O | latitud | Coordenada de latitud (opcional) |
| P | longitud | Coordenada de longitud (opcional) |
| Q | Tipo de CCT | Tipo de centro |
| R | ÁREA | Área de adscripción |
| S | ENLACE 1 | Nombre del enlace 1 |
| T | TELÉFONO ENLACE 1 | Teléfono del enlace 1 |
| U | ENLACE 2 | Nombre del enlace 2 |
| V | TEL. ENLACE 2 | Teléfono del enlace 2 |

## 🔧 Instalación local

1. Clona el repositorio:
```bash
git clone https://github.com/yairchaul/Consultas.git
