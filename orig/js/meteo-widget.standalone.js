/**
 * Meteo Warning Vector API for meteo.md (No Basemap Edition)
 */
const MeteoApi = (function () {
    let map = null;
    let geojsonLayer = null;
    let geoData = null;
    let activeWarnings = {};

    const COLOR_MAP = {
        green: '#4CAF50',
        yellow: '#FFEB3B',
        orange: '#FF9800',
        red: '#F44336'
    };

    function getFeatureId(feature) {
        return feature.properties.ID_1 || feature.properties.id || feature.properties.name || feature.properties.NAME_1;
    }

    // Авто-сброс в Зеленый при истечении срока
    function getDistrictState(districtId) {
        const raw = activeWarnings[districtId];
        if (!raw) return { level: 'green' };

        const now = new Date();

        if (raw.validUntil && new Date(raw.validUntil) <= now) {
            return { level: 'green' };
        }

        if (raw.validFrom && new Date(raw.validFrom) > now) {
            return { level: 'green' };
        }

        return raw;
    }

    function styleFeature(feature) {
        const id = getFeatureId(feature);
        const state = getDistrictState(id);
        
        return {
            fillColor: COLOR_MAP[state.level] || COLOR_MAP.green,
            weight: 1,          // Тонкие границы между районами
            opacity: 1,
            color: '#2e7d32',    // Сочный зеленый/темный контур границ
            fillOpacity: 0.95
        };
    }

    return {
        init: async function (config = {}) {
            const containerId = config.containerId || 'meteo-clean-map';
            const geojsonUrl = config.geojsonUrl || 'data/map.geojson';
            const warningsUrl = config.warningsUrl || 'data/meteo_warning_active.json';

            // Инициализация БЕЗ подложки OpenStreetMap
            map = L.map(containerId, {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                touchZoom: false
            });

            try {
                const [mapRes, warnRes] = await Promise.all([
                    fetch(geojsonUrl),
                    fetch(warningsUrl + '?t=' + Date.now()).catch(() => null)
                ]);

                if (!mapRes.ok) throw new Error('Ошибка загрузки GeoJSON');
                geoData = await mapRes.json();

                if (warnRes && warnRes.ok) {
                    activeWarnings = await warnRes.json();
                }

                this.render();

                // Авто-проверка времени каждые 15 секунд
                setInterval(() => this.refresh(), 15000);
            } catch (err) {
                console.error('MeteoApi Error:', err);
            }
        },

        render: function () {
            if (!geoData) return;
            if (geojsonLayer) map.removeLayer(geojsonLayer);

            geojsonLayer = L.geoJSON(geoData, {
                style: styleFeature,
                onEachFeature: (feature, layer) => {
                    layer.on({
                        mouseover: (e) => {
                            e.target.setStyle({ weight: 2, color: '#000000' });
                        },
                        mouseout: (e) => {
                            geojsonLayer.resetStyle(e.target);
                        }
                    });
                }
            }).addTo(map);

            // Автоматически масштабируем веторную карту строго под размер блока
            map.fitBounds(geojsonLayer.getBounds(), {
                padding: [5, 5]
            });
        },

        refresh: function () {
            if (geojsonLayer) {
                geojsonLayer.setStyle(styleFeature);
            }
        },

        setGlobalLevel: function (level) {
            const nowIso = new Date().toISOString();
            if (geoData && geoData.features) {
                geoData.features.forEach(f => {
                    const id = getFeatureId(f);
                    activeWarnings[id] = {
                        level: level,
                        validFrom: level === 'green' ? null : nowIso,
                        validUntil: null
                    };
                });
            }
            this.refresh();
        }
    };
})();