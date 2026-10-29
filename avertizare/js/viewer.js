document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('meteo-viewer-map');
    if (!mapElement) return;

    let selectedLayer = null;
    let activeWarnings = [];
    let geoJsonLayer = null;
    let markersGroup = L.layerGroup();

    // Карта без дефолтных бабблов
    const map = L.map('meteo-viewer-map', {
        zoomControl: true,
        attributionControl: false,
        boxZoom: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5
    }).setView(MeteoConfig.mapCenter, MeteoConfig.defaultZoom);

    markersGroup.addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.65
    }).addTo(map);

    function getColor(level) {
        return MeteoConfig.colors[parseInt(level, 10)] || MeteoConfig.colors[0];
    }

    // Принудительное точное название кода (включая Cod Galben)
    function getStatusText(level) {
        const lvl = parseInt(level, 10);
        if (lvl === 1) return 'COD GALBEN';
        if (lvl === 2) return 'COD PORTOCALIU';
        if (lvl === 3) return 'COD ROȘU';
        return 'VERDE';
    }

    function formatDate24(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        return String(dateStr).replace(/\s*(AM|PM)/gi, '').trim();
    }

    function resetSelection() {
        if (selectedLayer) {
            geoJsonLayer.resetStyle(selectedLayer);
            selectedLayer = null;
        }
        renderDefaultBottomPanel(activeWarnings);
        if (geoJsonLayer) {
            map.flyToBounds(geoJsonLayer.getBounds(), { padding: [30, 160], duration: 0.8 });
        }
    }

    document.getElementById('reset-map-btn')?.addEventListener('click', resetSelection);
    map.on('click', resetSelection);

    // Загрузка активных предупреждений
    fetch('data/meteo_warning_active.json')
        .then(res => res.json())
        .then(data => initMapData(map, data))
        .catch(() => renderDefaultBottomPanel([]));

    function initMapData(map, data) {
        activeWarnings = data.warnings || [];
        const geoData = data.geoData;

        renderTopActiveCodes(activeWarnings);
        renderDefaultBottomPanel(activeWarnings);

        markersGroup.clearLayers();

        geoJsonLayer = L.geoJSON(geoData, {
            style: function (feature) {
                const warnLevel = feature.properties.meteo_warn || 0;
                return {
                    weight: 1.5,
                    opacity: 0.9,
                    color: '#334155',
                    fillColor: getColor(warnLevel),
                    fillOpacity: warnLevel > 0 ? 0.7 : 0.35
                };
            },
            onEachFeature: function (feature, layer) {
                const districtName = feature.properties.NAMN || feature.properties.DENUMIRE || 'Raion';
                const warnList = feature.properties.warnings_list || [];
                const warnLevel = feature.properties.meteo_warn || 0;

                // Наведение мыши
                layer.on('mouseover', e => {
                    if (!selectedLayer) {
                        e.target.setStyle({ weight: 3, color: '#000000', fillOpacity: 0.85 });
                        e.target.bringToFront();
                        renderDistrictInBottomPanel(districtName, warnLevel, warnList);
                    }
                });

                layer.on('mouseout', e => {
                    if (!selectedLayer) {
                        geoJsonLayer.resetStyle(e.target);
                        renderDefaultBottomPanel(activeWarnings);
                    }
                });

                // Клик по району — фиксируем в нижнем окне
                layer.on('click', e => {
                    L.DomEvent.stopPropagation(e);
                    if (selectedLayer) {
                        geoJsonLayer.resetStyle(selectedLayer);
                    }
                    selectedLayer = e.target;
                    selectedLayer.setStyle({ weight: 3.5, color: '#0f172a', fillOpacity: 0.9 });
                    selectedLayer.bringToFront();

                    // Масштабируем карту с отступом снизу под панель
                    map.flyToBounds(selectedLayer.getBounds(), { 
                        paddingBottomRight: [20, 220],
                        paddingTopLeft: [20, 20],
                        maxZoom: 10, 
                        duration: 0.8 
                    });

                    renderDistrictInBottomPanel(districtName, warnLevel, warnList);
                });
            }
        }).addTo(map);

        if (geoData.features && geoData.features.length > 0) {
            map.fitBounds(geoJsonLayer.getBounds(), { paddingBottomRight: [20, 220] });
        }
    }

    // Формирование плашек активных кодов вверху
    function renderTopActiveCodes(warnings) {
        const container = document.getElementById('top-active-codes-list');
        if (!container) return;

        if (!warnings || warnings.length === 0) {
            container.innerHTML = '<span class="no-warnings-text">🟢 Nu sunt avertizări active</span>';
            return;
        }

        const grouped = {};
        warnings.forEach(w => {
            if (!grouped[w.level]) grouped[w.level] = new Set();
            grouped[w.level].add(w.phenomena);
        });

        const sortedLevels = Object.keys(grouped).map(Number).sort((a, b) => b - a);

        container.innerHTML = sortedLevels.map(level => {
            const list = Array.from(grouped[level]).join(', ');
            return `<div class="code-pill level-${level}">
                <span>${getStatusText(level)}:</span>
                <strong>${list}</strong>
            </div>`;
        }).join('');
    }

    // Вывод информации конкретного района в НИЖНЕЕ ОКНО
    function renderDistrictInBottomPanel(name, level, warningsList) {
        const titleBox = document.getElementById('district-info-box');
        const detailsContainer = document.getElementById('view-details-list');

        titleBox.style.borderLeftColor = getColor(level);
        titleBox.innerHTML = `${name} <span style="font-size:12px; opacity:0.8; margin-left:8px;">(${getStatusText(level)})</span>`;

        if (!warningsList || warningsList.length === 0) {
            detailsContainer.innerHTML = '<p style="font-size:12px; color:#64748b; margin:6px 0 0 0;">Nu sunt prognozate fenomene meteorologice periculoase în acest raion.</p>';
            return;
        }

        detailsContainer.innerHTML = warningsList.map(item => `
            <div class="warning-card-item level-${item.level}">
                <div class="card-head">
                    <span>${item.icon || '⚠️'} ${item.phenomena}</span>
                    <span>${getStatusText(item.level)}</span>
                </div>
                <div class="card-body">
                    <div class="card-meta">
                        Emis: <b>${formatDate24(item.issueDate)}</b><br>
                        Valabil: <b>${formatDate24(item.interval)}</b>
                    </div>
                    <div>${item.description || 'Fără descriere suplimentară.'}</div>
                </div>
            </div>
        `).join('');
    }

    // Сброс нижнего окна на общую сводку
    function renderDefaultBottomPanel(warnings) {
        const titleBox = document.getElementById('district-info-box');
        const detailsContainer = document.getElementById('view-details-list');

        const maxLevel = warnings.length > 0 ? Math.max(...warnings.map(w => w.level)) : 0;

        titleBox.style.borderLeftColor = getColor(maxLevel);
        titleBox.innerHTML = `REPUBLICA MOLDOVA <span style="font-size:12px; opacity:0.8; margin-left:8px;">(${getStatusText(maxLevel)})</span>`;

        if (!warnings || warnings.length === 0) {
            detailsContainer.innerHTML = '<p style="font-size:12px; color:#64748b; margin:6px 0 0 0;">Nu sunt prognozate fenomene meteorologice periculoase на данный момент.</p>';
            return;
        }

        detailsContainer.innerHTML = '<p style="font-size:12px; color:#64748b; margin:6px 0 0 0;">Selectați un raion de pe hartă pentru a afișa informațiile detaliate.</p>';
    }
});