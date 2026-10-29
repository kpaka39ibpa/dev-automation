document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('meteo-viewer-map');
    if (!mapContainer) return;

    let selectedLayer = null; // Хранит выбранный кликом район
    let globalWarnings = [];
    let geojsonLayer = null;

    // Инициализация карты بدون встроенного boxZoom и сторонних рамок
    const map = L.map('meteo-viewer-map', {
        zoomControl: true,
        attributionControl: false,
        boxZoom: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120
    }).setView(MeteoConfig.mapCenter, MeteoConfig.defaultZoom);

    // Векторная подложка OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    function getColor(warnLevel) {
        return MeteoConfig.colors[parseInt(warnLevel, 10)] || MeteoConfig.colors[0];
    }

    function getStatusText(warnLevel) {
        return MeteoConfig.statusTexts[parseInt(warnLevel, 10)] || MeteoConfig.statusTexts[0];
    }

    // Сброс выбора района при клике на свободную область карты
    map.on('click', () => {
        if (selectedLayer) {
            geojsonLayer.resetStyle(selectedLayer);
            selectedLayer = null;
        }
        resetToGlobalSummary(globalWarnings);
        map.flyToBounds(geojsonLayer.getBounds(), { padding: [10, 10], duration: 0.8 });
    });

    // Загрузка активных предупреждений из JSON
    fetch('data/meteo_warning_active.json')
        .then(res => res.json())
        .then(payload => renderViewerUI(map, payload))
        .catch(() => resetToGlobalSummary([]));

    function renderViewerUI(map, payload) {
        globalWarnings = payload.warnings || [];
        const geoData = payload.geoData;

        renderTopSummaryBar(globalWarnings);
        resetToGlobalSummary(globalWarnings);

        geojsonLayer = L.geoJSON(geoData, {
            style: function(feature) {
                const warn = feature.properties.meteo_warn || 0;
                return {
                    weight: 1.2,
                    opacity: 0.85,
                    color: '#475569',
                    fillColor: getColor(warn),
                    // Полупрозрачная заливка для просматриваемости рельефа карты
                    fillOpacity: warn > 0 ? 0.45 : 0.25
                };
            },
            onEachFeature: function(feature, layer) {
                const name = feature.properties.NAMN || feature.properties.DENUMIRE || 'Raion';
                const districtWarnings = feature.properties.warnings_list || [];
                const warnLevel = feature.properties.meteo_warn || 0;

                layer.bindTooltip(name, { permanent: false, direction: 'center' });

                // Ховер на район (работает, когда район не зафиксирован кликом)
                layer.on('mouseover', (e) => {
                    if (!selectedLayer) {
                        const l = e.target;
                        l.setStyle({ weight: 2.5, color: '#000000', fillOpacity: 0.55 });
                        l.bringToFront();
                        showDistrictDetailsUI(name, warnLevel, districtWarnings);
                    }
                });

                layer.on('mouseout', (e) => {
                    if (!selectedLayer) {
                        geojsonLayer.resetStyle(e.target);
                        resetToGlobalSummary(globalWarnings);
                    }
                });

                // КЛИК: Плавное приближение к району и фиксация информации в инфо-окне
                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);

                    if (selectedLayer) {
                        geojsonLayer.resetStyle(selectedLayer);
                    }

                    selectedLayer = e.target;
                    selectedLayer.setStyle({ weight: 2.5, color: '#0f172a', fillOpacity: 0.55 });
                    selectedLayer.bringToFront();

                    map.flyToBounds(selectedLayer.getBounds(), {
                        padding: [50, 50],
                        maxZoom: 10,
                        duration: 0.8
                    });

                    showDistrictDetailsUI(name, warnLevel, districtWarnings, true);
                });
            }
        }).addTo(map);

        if (geoData.features && geoData.features.length > 0) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [10, 10] });
        }
    }

    // Отрисовка верхней вертикальной панели со списком активных кодов и явлений
    function renderTopSummaryBar(warnings) {
        const topContainer = document.getElementById('top-active-codes-list');
        if (!topContainer) return;

        if (!warnings || warnings.length === 0) {
            topContainer.innerHTML = '<span class="no-warnings-text">🟢 Nu sunt avertizări active</span>';
            return;
        }

        // Группируем явления по коду опасности (1, 2, 3)
        const groupedByLevel = {};
        warnings.forEach(w => {
            if (!groupedByLevel[w.level]) {
                groupedByLevel[w.level] = new Set();
            }
            groupedByLevel[w.level].add(w.phenomena);
        });

        // Сортировка от высшего уровня к низшему
        const sortedLevels = Object.keys(groupedByLevel).map(Number).sort((a, b) => b - a);

        topContainer.innerHTML = sortedLevels.map(level => {
            const phenomenaList = Array.from(groupedByLevel[level]).join(', ');
            return `
                <div class="code-pill level-${level}">
                    <span>${getStatusText(level)}:</span>
                    <strong>${phenomenaList}</strong>
                </div>
            `;
        }).join('');
    }

    // Отображение деталей по конкретному району
    function showDistrictDetailsUI(districtName, maxWarnLevel, warningsList, isFixed = false) {
        const districtBox = document.getElementById('district-info-box');
        const detailsContainer = document.getElementById('view-details-list');

        const maxColor = getColor(maxWarnLevel);
        districtBox.style.borderLeftColor = maxColor;
        
        // В плашке района отображается только чистое название района
        districtBox.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span><strong>${districtName}</strong></span>
                ${isFixed ? '<span style="font-size:12px; cursor:pointer; opacity:0.6; padding: 2px 6px;" title="Resetare">✕</span>' : ''}
            </div>
        `;

        if (!warningsList || warningsList.length === 0) {
            detailsContainer.innerHTML = `<p style="font-size:11px; color:#64748b; margin:6px 0 0 0;">Nu sunt prognozate fenomene periculoase.</p>`;
            return;
        }

        detailsContainer.innerHTML = warningsList.map(w => `
            <div class="warning-detail-card level-${w.level}">
                <div class="detail-head">
                    <span>${w.icon || ''} ${w.phenomena}</span>
                    <span>${getStatusText(w.level)}</span>
                </div>
                <div class="detail-body">
                    <div class="detail-meta">
                        Emis: <b>${w.issueDate || '-'}</b><br>
                        Valabil: <b>${w.interval || '-'}</b>
                    </div>
                    <div>${w.description || ''}</div>
                </div>
            </div>
        `).join('');
    }

    // Общий сводный вид
    function resetToGlobalSummary(warnings) {
        const districtBox = document.getElementById('district-info-box');
        const detailsContainer = document.getElementById('view-details-list');

        const maxLevel = warnings.length > 0 ? Math.max(...warnings.map(w => w.level)) : 0;

        districtBox.style.borderLeftColor = getColor(maxLevel);
        districtBox.innerHTML = `<strong>REPUBLICA MOLDOVA</strong>`;

        if (!warnings || warnings.length === 0) {
            detailsContainer.innerHTML = '<p style="font-size:11px; color:#64748b; margin:6px 0 0 0;">Nu sunt prognozate fenomene meteorologice periculoase.</p>';
            return;
        }

        detailsContainer.innerHTML = '<p style="font-size:11px; color:#64748b; margin:6px 0 0 0;">Faceți clic pe un raion pentru a fixa informațiile și a mări zona.</p>';
    }
});