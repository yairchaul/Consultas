// ==================== URL REAL DE TU GOOGLE SHEETS (TSV) ====================
const GOOGLE_SHEET_TSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxAgXISY3emQKTuIKIvTHPGZI80gxsb6DDiZK2c_6Db09QoZ_aOI0bKvITvosX-8XhFDxUgkURgOtF/pub?gid=0&single=true&output=tsv';

let schoolsData = [];
let mapInstance = null;
let currentMarkers = [];
let geocodeCache = {}; // Caché para evitar geocodificar repetidamente

// Inicializar mapa
function initMap() {
    mapInstance = L.map('map').setView([19.4326, -99.1332], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
        maxZoom: 18
    }).addTo(mapInstance);
}

// Limpiar marcadores
function clearMarkers() {
    currentMarkers.forEach(marker => mapInstance.removeLayer(marker));
    currentMarkers = [];
}

// Escapar HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// Construir dirección completa para geocodificación
function buildFullAddress(school) {
    const parts = [
        school.calleYNumero,
        school.colonia,
        school.alcaldia,
        school.cP,
        'Ciudad de México',
        'México'
    ].filter(p => p && p !== 'N/A' && p !== '');
    return parts.join(', ');
}

// Geocodificar una dirección (convertir a coordenadas)
async function geocodeAddress(address, schoolId) {
    // Verificar caché
    if (geocodeCache[address]) {
        return geocodeCache[address];
    }
    
    // Pequeña pausa para no sobrecargar el servicio gratuito
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=mx`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            geocodeCache[address] = coords;
            return coords;
        }
    } catch (error) {
        console.error(`Error geocodificando ${address}:`, error);
    }
    return null;
}

// Renderizar lista + mapa (con geocodificación automática)
async function renderSchools(filteredSchools) {
    const resultCountSpan = document.getElementById('resultCount');
    resultCountSpan.innerText = filteredSchools.length;
    const totalSpan = document.getElementById('totalCountText');
    if (schoolsData.length) totalSpan.innerHTML = `📚 Total: ${schoolsData.length}`;

    const container = document.getElementById('resultsContainer');
    if (!filteredSchools.length) {
        container.innerHTML = `<div class="empty-state">🏫 No se encontraron centros.<br>Prueba con otro nombre o CCT.</div>`;
        clearMarkers();
        return;
    }

    // Mostrar loading en el panel de resultados
    container.innerHTML = `<div class="empty-state">🔄 Cargando mapa interactivo...</div>`;
    
    let cardsHtml = '';
    const bounds = L.latLngBounds();
    const newMarkers = [];
    const geocodePromises = [];

    // Primero, generar HTML de tarjetas
    filteredSchools.forEach((school, idx) => {
        const calle = school.calleYNumero || '';
        const colonia = school.colonia || '';
        const alcaldia = school.alcaldia || '';
        const cp = school.cP || '';
        const direccionCompleta = [calle, colonia, alcaldia, cp].filter(p => p && p !== 'N/A').join(', ') || 'Dirección no especificada';
        
        const escritorio = school.cantidadDeEquiposDeEscritorioRequeridos || '0';
        const laptop = school.cantidadDeEquiposLaptopRequeridos || '0';
        const laptopAlto = school.cantidadDeEquiposLaptopAltoDesempenoRequeridos || '0';
        const totalEquipos = school.totalDeEquipos || (parseInt(escritorio) + parseInt(laptop) + parseInt(laptopAlto)) || '0';
        
        const enlace1 = school.enlace1 || 'N/A';
        const tel1 = school.telefonoEnlace1 || 'N/A';
        const enlace2 = school.enlace2 || 'N/A';
        const tel2 = school.telEnlace2 || 'N/A';
        const tipoCCT = school.tipoDeCct || 'N/A';
        const diaEntrega = school.diaDeEntrega || 'N/A';

        cardsHtml += `
            <div class="school-card" data-idx="${idx}" data-nombre="${escapeHtml(school.nombreDelCct || '')}" data-cct="${escapeHtml(school.cct || '')}" data-direccion="${escapeHtml(direccionCompleta)}" data-calle="${escapeHtml(calle)}" data-colonia="${escapeHtml(colonia)}" data-alcaldia="${escapeHtml(alcaldia)}">
                <div class="school-name">
                    ${escapeHtml(school.nombreDelCct || 'Sin nombre')}
                    <span class="cct-badge">${escapeHtml(school.cct || 'Sin CCT')}</span>
                </div>
                <div class="school-address">
                    📍 ${escapeHtml(direccionCompleta)}
                </div>
                <div class="school-details">
                    <div><span>📦 Escritorio:</span> ${escritorio}</div>
                    <div><span>💻 Laptop:</span> ${laptop}</div>
                    <div><span>⚡ Laptop AD:</span> ${laptopAlto}</div>
                    <div><span>📊 Total equipos:</span> ${totalEquipos}</div>
                    <div><span>🏷️ Tipo CCT:</span> ${escapeHtml(tipoCCT)}</div>
                    <div><span>📅 Día entrega:</span> ${escapeHtml(diaEntrega)}</div>
                    <div><span>👤 Enlace 1:</span> ${escapeHtml(enlace1)} / ${escapeHtml(tel1)}</div>
                    <div><span>👤 Enlace 2:</span> ${escapeHtml(enlace2)} / ${escapeHtml(tel2)}</div>
                </div>
                <button class="ver-mapa-link" data-direccion="${escapeHtml(direccionCompleta)}" data-nombre="${escapeHtml(school.nombreDelCct || '')}">
                    🗺️ Ver en Google Maps
                </button>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
    
    // Segundo paso: geocodificar direcciones para los marcadores
    const schoolsWithAddresses = filteredSchools.map((school, idx) => ({
        school,
        idx,
        address: buildFullAddress(school)
    })).filter(item => item.address && item.address !== 'Ciudad de México, México');

    // Mostrar indicador de carga en el mapa
    const loadingControl = L.control({ position: 'bottomright' });
    loadingControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = '📍 Cargando ubicaciones...';
        div.style.background = 'white';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '20px';
        div.style.fontSize = '11px';
        return div;
    };
    loadingControl.addTo(mapInstance);

    // Geocodificar en lotes pequeños
    for (let i = 0; i < schoolsWithAddresses.length; i++) {
        const { school, idx, address } = schoolsWithAddresses[i];
        const coords = await geocodeAddress(address, school.cct);
        
        if (coords) {
            const popupContent = `
                <b>${escapeHtml(school.nombreDelCct || 'Sin nombre')}</b><br>
                <span style="font-size:0.65rem">${escapeHtml(school.cct || '')}</span><br>
                ${escapeHtml(address.substring(0, 80))}
            `;
            const marker = L.marker([coords.lat, coords.lng]).addTo(mapInstance);
            marker.bindPopup(popupContent);
            
            // Al hacer clic en marcador, resaltar tarjeta
            marker.on('click', () => {
                const card = document.querySelector(`.school-card[data-cct="${escapeHtml(school.cct).replace(/"/g, '&quot;')}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    card.style.transition = '0.3s';
                    card.style.borderColor = '#ffb74d';
                    card.style.backgroundColor = '#fff8e7';
                    setTimeout(() => {
                        card.style.borderColor = '#edf2f7';
                        card.style.backgroundColor = 'white';
                    }, 1500);
                }
            });
            
            newMarkers.push(marker);
            bounds.extend([coords.lat, coords.lng]);
        }
        
        // Actualizar progreso en el mapa cada 5 escuelas
        if (i % 5 === 0) {
            loadingControl._container.innerHTML = `📍 Procesando ${i + 1}/${schoolsWithAddresses.length}...`;
        }
    }
    
    // Quitar control de carga
    mapInstance.removeControl(loadingControl);
    
    clearMarkers();
    newMarkers.forEach(m => currentMarkers.push(m));

    if (newMarkers.length > 0 && bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
    } else {
        mapInstance.setView([19.4326, -99.1332], 11);
        if (newMarkers.length === 0) {
            const infoControl = L.control({ position: 'bottomright' });
            infoControl.onAdd = function() {
                const div = L.DomUtil.create('div', 'info legend');
                div.innerHTML = '⚠️ No se pudieron geolocalizar centros. Verifica direcciones.';
                div.style.background = 'white';
                div.style.padding = '5px 10px';
                div.style.borderRadius = '20px';
                div.style.fontSize = '11px';
                div.style.color = '#c62828';
                return div;
            };
            infoControl.addTo(mapInstance);
            setTimeout(() => mapInstance.removeControl(infoControl), 5000);
        }
    }

    // Botones "Ver en Google Maps"
    document.querySelectorAll('.ver-mapa-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const direccion = btn.dataset.direccion;
            if (direccion && direccion !== 'Dirección no especificada') {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`, '_blank');
            } else {
                alert('No hay dirección suficiente para generar el mapa');
            }
        });
    });

    // Al hacer clic en tarjeta: centrar mapa en su marcador
    document.querySelectorAll('.school-card').forEach(card => {
        card.addEventListener('click', async () => {
            const cct = card.querySelector('.cct-badge')?.innerText?.replace('CCT:', '').trim();
            const matched = filteredSchools.find(s => s.cct === cct);
            if (matched) {
                const address = buildFullAddress(matched);
                const coords = await geocodeAddress(address, matched.cct);
                if (coords) {
                    mapInstance.setView([coords.lat, coords.lng], 16);
                    const marker = currentMarkers.find(m => {
                        const pos = m.getLatLng();
                        return pos.lat === coords.lat && pos.lng === coords.lng;
                    });
                    if (marker) marker.openPopup();
                } else if (address && address !== 'Ciudad de México, México') {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                }
            }
        });
    });
}

// Búsqueda
function performSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!query) {
        renderSchools(schoolsData);
        return;
    }
    const filtered = schoolsData.filter(school => 
        (school.nombreDelCct || '').toLowerCase().includes(query) || 
        (school.cct || '').toLowerCase().includes(query)
    );
    renderSchools(filtered);
}

// Debounce
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Parsear TSV
function parseTSVToSchools(tsvText) {
    const lines = tsvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    
    const getIndex = (possibleNames) => {
        for (let name of possibleNames) {
            const idx = headers.findIndex(h => h === name);
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idxNombre = getIndex(['nombre del cct', 'nombre del centro', 'nombre']);
    const idxCCT = getIndex(['cct']);
    const idxCalle = getIndex(['calle y número', 'calle y numero']);
    const idxColonia = getIndex(['colonia']);
    const idxAlcaldia = getIndex(['alcaldía', 'alcaldia']);
    const idxCP = getIndex(['c. p.', 'cp']);
    const idxDiaEntrega = getIndex(['día de entrega']);
    const idxEscritorio = getIndex(['cantidad de equipos de escritorio requeridos']);
    const idxLaptop = getIndex(['cantidad de equipos laptop requeridos']);
    const idxLaptopAD = getIndex(['cantidad de equipos laptop alto desempeño requeridos']);
    const idxTotal = getIndex(['total de equipos']);
    const idxTipoCCT = getIndex(['tipo de cct']);
    const idxEnlace1 = getIndex(['enlace 1']);
    const idxTel1 = getIndex(['teléfono enlace 1']);
    const idxEnlace2 = getIndex(['enlace 2']);
    const idxTel2 = getIndex(['tel. enlace 2']);

    const schools = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length < 2) continue;
        const school = {
            nombreDelCct: idxNombre !== -1 ? values[idxNombre] || '' : '',
            cct: idxCCT !== -1 ? values[idxCCT] || '' : '',
            calleYNumero: idxCalle !== -1 ? values[idxCalle] || '' : '',
            colonia: idxColonia !== -1 ? values[idxColonia] || '' : '',
            alcaldia: idxAlcaldia !== -1 ? values[idxAlcaldia] || '' : '',
            cP: idxCP !== -1 ? values[idxCP] || '' : '',
            diaDeEntrega: idxDiaEntrega !== -1 ? values[idxDiaEntrega] || '' : '',
            cantidadDeEquiposDeEscritorioRequeridos: idxEscritorio !== -1 ? values[idxEscritorio] || '0' : '0',
            cantidadDeEquiposLaptopRequeridos: idxLaptop !== -1 ? values[idxLaptop] || '0' : '0',
            cantidadDeEquiposLaptopAltoDesempenoRequeridos: idxLaptopAD !== -1 ? values[idxLaptopAD] || '0' : '0',
            totalDeEquipos: idxTotal !== -1 ? values[idxTotal] || '0' : '0',
            tipoDeCct: idxTipoCCT !== -1 ? values[idxTipoCCT] || '' : '',
            enlace1: idxEnlace1 !== -1 ? values[idxEnlace1] || '' : '',
            telefonoEnlace1: idxTel1 !== -1 ? values[idxTel1] || '' : '',
            enlace2: idxEnlace2 !== -1 ? values[idxEnlace2] || '' : '',
            telEnlace2: idxTel2 !== -1 ? values[idxTel2] || '' : ''
        };
        if (school.nombreDelCct || school.cct) schools.push(school);
    }
    return schools;
}

// Cargar datos
async function loadData() {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = `<div class="empty-state">🔄 Cargando ${schoolsData.length ? 'actualizando' : ''} datos...</div>`;
    try {
        const response = await fetch(GOOGLE_SHEET_TSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!text || text.includes('<!DOCTYPE')) throw new Error('URL inválida o sin permisos públicos');
        schoolsData = parseTSVToSchools(text);
        if (!schoolsData.length) throw new Error('No se encontraron registros');
        await renderSchools(schoolsData);
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="empty-state" style="color:#c62828;">
                ⚠️ Error cargando datos.<br>
                Verifica que la hoja esté publicada como TSV y con acceso público.
            </div>`;
        document.getElementById('totalCountText').innerHTML = '⚠️ Error';
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    searchInput.addEventListener('input', debounce(performSearch, 300));
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        performSearch();
        searchInput.focus();
    });
});
