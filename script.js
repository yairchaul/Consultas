document.addEventListener('DOMContentLoaded', () => {
    // PEGA AQUÍ LA URL de tu hoja de Google Sheets publicada como TSV (Valores Separados por Tabulaciones)
    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxAgXISY3emQKTuIKIvTHPGZI80gxsb6DDiZK2c_6Db09QoZ_aOI0bKvITvosX-8XhFDxUgkURgOtF/pub?gid=0&single=true&output=tsv';

    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const resultCountSpan = document.getElementById('resultCount');
    const totalCountText = document.getElementById('totalCountText');

    let schoolsData = [];
    let mapInstance = null;
    let currentMarkers = [];

    // Inicializa el mapa centrado en México
    function initMap() {
        mapInstance = L.map('map').setView([23.6345, -102.5528], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
        }).addTo(mapInstance);
    }

    // 1. Función para convertir los encabezados a un formato estándar (camelCase)
    function toCamelCase(str) {
        // Elimina acentos y caracteres especiales, luego convierte a camelCase
        return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '')
            .replace(/^./, (match) => match.toLowerCase());
    }

    // 2. Función para procesar el texto TSV a un array de objetos
    function parseTSV(text) {
        const lines = text.trim().split(/\r\n|\n/);
        const rawHeaders = lines[0].split('\t');
        const headers = rawHeaders.map(h => toCamelCase(h));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const obj = {};
            const currentline = lines[i].split('\t');
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j] || '';
            }
            data.push(obj);
        }
        return data;
    }

    // Función de utilidad para "debounce" (evita ejecutar la búsqueda en cada pulsación de tecla)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Función para escapar HTML y prevenir XSS
    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, m => map[m]);
    }

    // 3. Función para mostrar los resultados en el HTML
    function displayResults(results) {
        // Actualizar contadores
        resultCountSpan.textContent = results.length;
        if (schoolsData.length > 0) {
            totalCountText.innerHTML = `📚 Total: ${schoolsData.length} centros`;
        }

        // Limpiar marcadores anteriores del mapa
        currentMarkers.forEach(marker => mapInstance.removeLayer(marker));
        currentMarkers = [];

        if (results.length === 0 && schoolsData.length > 0) {
            resultsContainer.innerHTML = '<div class="empty-state">🏫 No se encontraron centros.</div>';
            return;
        }

        const bounds = L.latLngBounds();

        const html = results.map((school, index) => {
            const addressParts = [school.calleYNumero, school.colonia, school.alcaldia, school.cP].filter(Boolean);
            const fullAddress = addressParts.join(', ');

            // Añadir marcador al mapa si hay coordenadas
            // Asumimos que tus columnas se llaman 'Latitud' y 'Longitud' en el TSV
            const lat = parseFloat(school.latitud);
            const lng = parseFloat(school.longitud);

            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng]).addTo(mapInstance);
                marker.bindPopup(`<b>${escapeHtml(school.nombreDelCct)}</b><br>${escapeHtml(school.cct)}`);
                currentMarkers.push(marker);
                bounds.extend([lat, lng]);
            }

            return `
                <div class="result-item" data-lat="${lat}" data-lng="${lng}">
                    <h3>${escapeHtml(school.nombreDelCct)}</h3>
                    <p class="cct-tag">${escapeHtml(school.cct)}</p>
                    <p class="address">📍 ${escapeHtml(fullAddress) || 'Dirección no disponible'}</p>
                    <!-- Aquí puedes añadir más detalles si lo deseas -->
                </div>`;
        }).join('');

        resultsContainer.innerHTML = html;

        // Ajustar el mapa para que muestre todos los marcadores
        if (bounds.isValid()) {
            mapInstance.fitBounds(bounds, { padding: [50, 50] });
        }

        // Añadir eventos de clic a las nuevas tarjetas
        document.querySelectorAll('.result-item').forEach(card => {
            card.addEventListener('click', () => {
                const lat = parseFloat(card.dataset.lat);
                const lng = parseFloat(card.dataset.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    mapInstance.setView([lat, lng], 16); // Zoom más cercano al hacer clic
                }
            });
        });
    }
    
    // 4. Función de búsqueda que filtra por Nombre o CCT
    function searchSchools(query) {
        if (!query) {
            return schoolsData;
        }
        query = query.toLowerCase().trim();
        return schoolsData.filter(school => {
            const schoolName = school.nombreDelCct ? school.nombreDelCct.toLowerCase() : '';
            const cct = school.cct ? school.cct.toLowerCase() : '';
            return schoolName.includes(query) || cct.includes(query);
        });
    }

    // --- INICIO DE LA APLICACIÓN ---
    initMap();
    resultsContainer.innerHTML = '<p class="loading">Cargando datos...</p>';
    // 5. Cargar datos y configurar la búsqueda
    fetch(googleSheetUrl)
        .then(response => {            
            if (!response.ok) {
                // Si la respuesta no es 200 (OK), lanzamos un error con el status.
                // 404: No encontrado (URL incorrecta o hoja no publicada)
                throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
            }
            return response.text();
        })
        .then(tsvText => {
            // Si el texto está vacío o es una página de error de Google, también es un problema.
            if (!tsvText || tsvText.trim().startsWith('<!DOCTYPE html>')) {
                throw new Error('Los datos recibidos no son válidos. Parece que la URL es de una página de error de Google y no de los datos TSV. Verifica los permisos de publicación.');
            }
            schoolsData = parseTSV(tsvText);
            displayResults(schoolsData); // Muestra todos los resultados al inicio

            // Creamos una versión "debounced" de la función de búsqueda
            const debouncedSearch = debounce((query) => {
                const filteredResults = searchSchools(query);
                displayResults(filteredResults);
            }, 300); // Espera 300ms después de que el usuario deja de escribir

            // Una vez cargados los datos, activamos la funcionalidad de búsqueda
        })
        .catch(error => {
            console.error('Ha ocurrido un error al intentar cargar los datos:', error);
            let errorMessage = `<strong>No se pudieron cargar los datos.</strong><br><br>La causa más probable es que la URL de Google Sheets ya no es válida o los permisos de publicación no son correctos.`;
        
            errorMessage += `<br><br><strong>Pasos para solucionarlo:</strong>
            <ol style="text-align: left; margin-left: 20px; padding-left: 20px;">
                <li>Abre tu hoja de cálculo de Google.</li>
                <li>Ve a <strong>Archivo &gt; Compartir &gt; Publicar en la Web</strong>.</li>
                <li>Si ya estaba publicada, haz clic en "Detener la publicación" y luego en "Publicar" de nuevo.</li>
                <li>Asegúrate de que en la configuración de publicación, el acceso <strong>NO esté restringido</strong> a tu organización. Debe ser público para "Cualquier persona con el enlace".</li>
                <li>Copia la <strong>NUEVA</strong> URL generada y pégala en el archivo <code>script.js</code>.</li>
            </ol>`;

            errorMessage += `<br><strong>Detalle técnico del error:</strong> ${error.message}`;

            resultsContainer.innerHTML = `<p class="error">${errorMessage}</p>`;
        });
});