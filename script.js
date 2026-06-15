// ==================== CONFIGURACIÓN ====================
const GOOGLE_SHEET_TSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxAgXISY3emQKTuIKIvTHPGZI80gxsb6DDiZK2c_6Db09QoZ_aOI0bKvITvosX-8XhFDxUgkURgOtF/pub?gid=0&single=true&output=tsv';

let schoolsData = [];
let mapInstance = null;
let currentMarkers = [];
let geocodeCache = {};

// Inicializar mapa
function initMap() {
    mapInstance = L.map('map').setView([19.4326, -99.1332], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
        maxZoom: 18
    }).addTo(mapInstance);
}

function clearMarkers() {
    if (currentMarkers) {
        currentMarkers.forEach(marker => mapInstance.removeLayer(marker));
        currentMarkers = [];
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function buildFullAddress(school) {
    const parts = [
        school.calleYNumero,
        school.colonia,
        school.alcaldia,
        school.cP,
        'CDMX',
        'México'
    ].filter(p => p && p !== 'N/A' && p !== '');
    return parts.join(', ');
}

async function geocodeAddress(address) {
    if (geocodeCache[address]) return geocodeCache[address];
    await new Promise(resolve => setTimeout(resolve, 150));
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=mx`);
        const data = await response.json();
        if (data && data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            geocodeCache[address] = coords;
            return coords;
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return null;
}

// CENTRAR MAPA EN UNA ESCUELA (interactivo)
async function centerMapOnSchool(school) {
    const address = buildFullAddress(school);
    const coords = await geocodeAddress(address);
    
    if (coords) {
        mapInstance.setView([coords.lat, coords.lng], 17);
        const marker = currentMarkers.find(m => {
            const pos = m.getLatLng();
            return Math.abs(pos.lat - coords.lat) < 0.0001 && Math.abs(pos.lng - coords.lng) < 0.0001;
        });
        if (marker) marker.openPopup();
        return true;
    }
    return false;
}

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

    container.innerHTML = `<div class="empty-state">🔄 Cargando mapa interactivo...</div>`;
    
    let cardsHtml = '';
    const bounds = L.latLngBounds();
    const newMarkers = [];

    // Generar tarjetas
    filteredSchools.forEach((school) => {
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
            <div class="school-card" data-cct="${escapeHtml(school.cct || '')}">
                <div class="school-name">
                    🏫 ${escapeHtml(school.nombreDelCct || 'Sin nombre')}
                    <span class="cct-badge">${escapeHtml(school.cct || 'Sin CCT')}</span>
                </div>
                <div class="school-address">
                    📍 ${escapeHtml(direccionCompleta)}
                </div>
                <div class="school-details">
                    <div><span>🖥️ Escritorio:</span> ${escritorio}</div>
                    <div><span>💻 Laptop:</span> ${laptop}</div>
                    <div><span>⚡ Laptop AD:</span> ${laptopAlto}</div>
                    <div><span>📊 Total:</span> ${totalEquipos}</div>
                    <div><span>🏷️ Tipo CCT:</span> ${escapeHtml(tipoCCT)}</div>
                    <div><span>📅 Entrega:</span> ${escapeHtml(diaEntrega)}</div>
                    <div><span>👤 Enlace 1:</span> ${escapeHtml(enlace1)} / ${escapeHtml(tel1)}</div>
                    <div><span>👤 Enlace 2:</span> ${escapeHtml(enlace2)} / ${escapeHtml(tel2)}</div>
                </div>
                <button class="ver-mapa-link" data-direccion="${escapeHtml(direccionCompleta)}">
                    🗺️ Ver en Google Maps
                </button>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
    
    // Geocodificar y crear marcadores
    const schoolsWithAddresses = filteredSchools.map(school => ({
        school,
        address: buildFullAddress(school)
    })).filter(item => item.address && item.address !== 'CDMX, México');

    for (let i = 0; i < schoolsWithAddresses.length; i++) {
        const { school, address } = schoolsWithAddresses[i];
        const coords = await geocodeAddress(address);
        
        if (coords) {
            const popupContent = `
                <b>${escapeHtml(school.nombreDelCct || 'Sin nombre')}</b><br>
                <span style="font-size:0.65rem">${escapeHtml(school.cct || '')}</span><br>
                ${escapeHtml(address.substring(0, 80))}
            `;
            const marker = L.marker([coords.lat, coords.lng]).addTo(mapInstance);
            marker.bindPopup(popupContent);
            newMarkers.push(marker);
            bounds.extend([coords.lat, coords.lng]);
        }
    }
    
    clearMarkers();
    currentMarkers = newMarkers;

    if (newMarkers.length > 0 && bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
    } else {
        mapInstance.setView([19.4326, -99.1332], 11);
    }

    // EVENTO: Al hacer clic en tarjeta → centrar mapa (NO abre Google Maps)
    document.querySelectorAll('.school-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            if (e.target.classList.contains('ver-mapa-link')) return;
            const cct = card.dataset.cct;
            const matched = filteredSchools.find(s => s.cct === cct);
            if (matched) {
                await centerMapOnSchool(matched);
                // Resaltar tarjeta
                card.style.transition = '0.3s';
                card.style.borderColor = '#ffb74d';
                card.style.backgroundColor = '#fff8e7';
                setTimeout(() => {
                    card.style.borderColor = '#edf2f7';
                    card.style.backgroundColor = 'white';
                }, 1500);
            }
        });
    });

    // Botón Ver en Google Maps (único que abre externo)
    document.querySelectorAll('.ver-mapa-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const direccion = btn.dataset.direccion;
            if (direccion && direccion !== 'Dirección no especificada') {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`, '_blank');
            } else {
                alert('No hay dirección suficiente');
            }
        });
    });
}

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

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

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
    const idxDiaEntrega = getIndex(['día de entrega', 'dia de entrega']);
    const idxEscritorio = getIndex(['cantidad de equipos de escritorio requeridos']);
    const idxLaptop = getIndex(['cantidad de equipos laptop requeridos']);
    const idxLaptopAD = getIndex(['cantidad de equipos laptop alto desempeño requeridos']);
    const idxTotal = getIndex(['total de equipos']);
    const idxTipoCCT = getIndex(['tipo de cct', 'tipo de cct']);
    const idxEnlace1 = getIndex(['enlace 1']);
    const idxTel1 = getIndex(['teléfono enlace 1', 'telefono enlace 1']);
    const idxEnlace2 = getIndex(['enlace 2']);
    const idxTel2 = getIndex(['tel. enlace 2', 'teléfono enlace 2']);

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

async function loadData() {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = `<div class="empty-state">🔄 Cargando datos...</div>`;
    try {
        const response = await fetch(GOOGLE_SHEET_TSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!text || text.includes('<!DOCTYPE')) throw new Error('URL inválida');
        schoolsData = parseTSVToSchools(text);
        if (!schoolsData.length) throw new Error('No hay registros');
        await renderSchools(schoolsData);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="empty-state" style="color:#c62828;">⚠️ Error cargando datos.<br>Verifica que la hoja esté publicada.</div>`;
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
