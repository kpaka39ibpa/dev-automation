/**
 * Meteo Warning Direct Vector API (SVG Mode / No-Iframe)
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

    function getFeatureId(f) {
        return f.properties.ID_1 || f.properties.id || f.properties.name || f.properties.NAME_1;
    }

    // Проверка времени действия кодов
    function getDistrictStatus(districtId) {
        const raw = activeWarnings[districtId];
        if (!raw) return 'green';

        const now = new Date();

        if (raw.validUntil && new Date(raw.validUntil) <= now) {
            return 'green';
        }

        if (raw.validFrom && new Date(raw.validFrom) > now) {
            return 'green';
        }

        return raw.level || 'green';
    }

    function styleFeature(feature) {
        const id = getFeatureId(feature);
        const level = getDistrictStatus(id);
        
        return {
            fillColor: COLOR_MAP[level] || COLOR_MAP.green,
            weight: 1,
            opacity: 1,
            color: '#ffffff', // Белые аккуратные границы
            fillOpacity: 0.95
        };
    }

    return {
        init: async function (config = {}) {
            const containerId = config.containerId || 'meteo-svg-map';
            const geojsonUrl = config.geojsonUrl || 'data/map.geojson';
            const warningsUrl = config.warningsUrl || 'data/meteo_warning_active.json';

            const container = document.getElementById(containerId);
            if (!container) return;

            // Чистая инициализация рендера без тайловых карт
            map = L.map(containerId, {
                renderer: L.svg(),
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                touchZoom: false,
                keyboard: false
            });

            try {
                const [mapRes, warnRes] = await Promise.all([
                    fetch(geojsonUrl),
                    fetch(warningsUrl + '?t=' + Date.now()).catch(() => null)
                ]);

                if (!mapRes.ok) return;
                geoData = await mapRes.json();

                if (warnRes && warnRes.ok) {
                    activeWarnings = await warnRes.json();
                }

                this.render();

                // Авто-пересчет цветов по времени каждые 15 сек
                setInterval(() => this.refresh(), 15000);
            } catch (err) {
                console.error('MeteoApi Init Error:', err);
            }
        },

        render: function () {
            if (!geoData || !map) return;
            if (geojsonLayer) map.removeLayer(geojsonLayer);

            geojsonLayer = L.geoJSON(geoData, {
                style: styleFeature,
                onEachFeature: (feature, layer) => {
                    layer.on({
                        mouseover: (e) => e.target.setStyle({ weight: 2, color: '#333333' }),
                        mouseout: (e) => geojsonLayer.resetStyle(e.target)
                    });
                }
            }).addTo(map);

            // Идеальное вписывание контура Молдовы в границы блока
            map.fitBounds(geojsonLayer.getBounds(), {
                padding: [2, 2]
            });
        },

        refresh: function () {
            if (geojsonLayer) {
                geojsonLayer.setStyle(styleFeature);
            }
        },

        // --- Публичный API ---
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
        },

        getWarnings: function () {
            return activeWarnings;
        }
    };
})();