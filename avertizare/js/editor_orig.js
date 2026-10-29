let map;
let geojsonLayer;
let geoData = null;
let activeWarnings = {};

const COLOR_MAP = {
    green: '#28a745',
    yellow: '#ffc107',
    orange: '#fd7e14',
    red: '#dc3545'
};

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadData();
});

function initMap() {
    map = L.map('map').setView([47.0105, 28.8638], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

async function loadData() {
    try {
        const [mapRes, warnRes] = await Promise.all([
            fetch('data/map.geojson'),
            fetch('data/meteo_warning_active.json?t=' + new Date().getTime()).catch(() => null)
        ]);

        geoData = await mapRes.json();
        
        if (warnRes && warnRes.ok) {
            activeWarnings = await warnRes.json();
        } else {
            initEmptyWarnings();
        }

        renderGeoJSON();
        populateDistrictSelect();
    } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
    }
}

function initEmptyWarnings() {
    activeWarnings = {};
    if (geoData && geoData.features) {
        geoData.features.forEach(f => {
            const id = f.properties.ID_1 || f.properties.id || f.properties.name;
            activeWarnings[id] = {
                level: 'green',
                validFrom: null,
                validUntil: null,
                description: ''
            };
        });
    }
}

function getStyle(feature) {
    const id = feature.properties.ID_1 || feature.properties.id || feature.properties.name;
    const warning = activeWarnings[id] || { level: 'green' };
    
    return {
        fillColor: COLOR_MAP[warning.level] || COLOR_MAP.green,
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.75
    };
}

function renderGeoJSON() {
    if (geojsonLayer) {
        map.removeLayer(geojsonLayer);
    }

    geojsonLayer = L.geoJSON(geoData, {
        style: getStyle,
        onEachFeature: (feature, layer) => {
            const id = feature.properties.ID_1 || feature.properties.id || feature.properties.name;
            const name = feature.properties.NAME_1 || feature.properties.name || id;

            layer.bindTooltip(name, { permanent: false, direction: 'center' });

            layer.on({
                mouseover: (e) => {
                    e.target.setStyle({ weight: 3, color: '#333' });
                },
                mouseout: (e) => {
                    geojsonLayer.resetStyle(e.target);
                },
                click: () => {
                    document.getElementById('districtSelect').value = id;
                    loadDistrictToForm(id);
                }
            });
        }
    }).addTo(map);
}

function populateDistrictSelect() {
    const select = document.getElementById('districtSelect');
    select.innerHTML = '';
    
    if (!geoData || !geoData.features) return;

    geoData.features.forEach(f => {
        const id = f.properties.ID_1 || f.properties.id || f.properties.name;
        const name = f.properties.NAME_1 || f.properties.name || id;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
    });

    if (geoData.features.length > 0) {
        const firstId = geoData.features[0].properties.ID_1 || geoData.features[0].properties.id || geoData.features[0].properties.name;
        loadDistrictToForm(firstId);
    }
}

function onDistrictSelectChange(id) {
    loadDistrictToForm(id);
    highlightDistrictOnMap(id);
}

function loadDistrictToForm(id) {
    const w = activeWarnings[id] || { level: 'green', validFrom: '', validUntil: '', description: '' };
    document.getElementById('warningLevel').value = w.level || 'green';
    document.getElementById('validFrom').value = w.validFrom ? w.validFrom.slice(0, 16) : '';
    document.getElementById('validUntil').value = w.validUntil ? w.validUntil.slice(0, 16) : '';
    document.getElementById('warningText').value = w.description || '';
}

function highlightDistrictOnMap(id) {
    if (!geojsonLayer) return;
    geojsonLayer.eachLayer(layer => {
        const featId = layer.feature.properties.ID_1 || layer.feature.properties.id || layer.feature.properties.name;
        if (featId === id) {
            layer.setStyle({ weight: 3, color: '#000' });
        } else {
            geojsonLayer.resetStyle(layer);
        }
    });
}

function saveDistrictWarning() {
    const id = document.getElementById('districtSelect').value;
    if (!id) return;

    activeWarnings[id] = {
        level: document.getElementById('warningLevel').value,
        validFrom: document.getElementById('validFrom').value || null,
        validUntil: document.getElementById('validUntil').value || null,
        description: document.getElementById('warningText').value || '',
        updatedAt: new Date().toISOString()
    };

    geojsonLayer.setStyle(getStyle);
    alert('Параметры района успешно сохранены!');
}

/* === Функция массовой установки кодов для всей страны === */
function setGlobalLevel(level) {
    const now = new Date().toISOString();
    
    // Проходим по всем известным районам из GeoJSON или activeWarnings
    if (geoData && geoData.features) {
        geoData.features.forEach(f => {
            const id = f.properties.ID_1 || f.properties.id || f.properties.name;
            if (level === 'green') {
                activeWarnings[id] = {
                    level: 'green',
                    validFrom: null,
                    validUntil: null,
                    description: '',
                    updatedAt: now
                };
            } else {
                activeWarnings[id] = {
                    ...activeWarnings[id],
                    level: level,
                    updatedAt: now
                };
            }
        });
    }

    // Обновляем форму текущего выбранного района
    const currentId = document.getElementById('districtSelect').value;
    if (currentId) {
        loadDistrictToForm(currentId);
    }

    // Перерисовываем карту с новыми цветами
    geojsonLayer.setStyle(getStyle);
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeWarnings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "meteo_warning_active.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}