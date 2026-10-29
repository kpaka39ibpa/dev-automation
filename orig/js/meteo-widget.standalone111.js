/**
 * Standalone Meteoalarm Moldova Widget (Shadow DOM Encapsulated)
 */
class MeteoAlarmWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'closed' }); // closed Shadow DOM защищает внутренний DOM от прямого доступа
    }

    connectedCallback() {
        const jsonSrc = this.getAttribute('json-src') || 'data/meteo_warning_active.json';
        this.renderBaseStructure();
        this.loadLeafletAndInit(jsonSrc);
    }

    renderBaseStructure() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                }

                /* Подключение встроенных стилей Leaflet внутри Shadow DOM */
                @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

                .meteo-viewer-container {
                    position: relative;
                    width: 100%;
                    height: 85vh;
                    background-color: #f8fafc;
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
                    border: 1px solid #cbd5e1;
                    box-sizing: border-box;
                }

                .map-frame {
                    width: 100%;
                    height: 100%;
                }

                .viewer-card-panel {
                    position: absolute;
                    top: 18px;
                    left: 18px;
                    z-index: 1000;
                    background: rgba(255, 255, 255, 0.96);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid #cbd5e1;
                    backdrop-filter: blur(10px);
                    color: #0f172a;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 340px;
                    box-shadow: 0 15px 30px -5px rgba(0,0,0,0.12);
                    max-height: 80vh;
                    overflow-y: auto;
                    box-sizing: border-box;
                }

                .viewer-title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.2px;
                }

                .badge-list {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 10px;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 11px;
                    color: #1e293b;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
                }

                .badge .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }

                .details-list-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .warning-detail-card {
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-left: 4px solid #cbd5e1;
                    padding: 12px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .warning-detail-card.level-1 { border-left-color: #facc15; }
                .warning-detail-card.level-2 { border-left-color: #f97316; }
                .warning-detail-card.level-3 { border-left-color: #ef4444; }

                .detail-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    font-weight: 700;
                }

                .detail-badge {
                    padding: 3px 7px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 800;
                    color: #000000;
                }

                .detail-meta {
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 6px;
                    line-height: 1.45;
                }

                .detail-text {
                    font-size: 11.5px;
                    color: #334155;
                    margin: 8px 0 0 0;
                    line-height: 1.45;
                }

                .legend-panel {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(8px);
                    padding: 10px 14px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #334155;
                }

                .legend-color-box {
                    width: 14px;
                    height: 14px;
                    border-radius: 3px;
                    border: 1px solid rgba(0,0,0,0.1);
                }

                .viewer-description {
                    font-size: 12px;
                    line-height: 1.5;
                    color: #475569;
                    margin: 0;
                }
            </style>

            <div class="meteo-viewer-container">
                <div class="viewer-card-panel">
                    <h2 class="viewer-title">AVERTIZĂRI METEOROLOGICE</h2>
                    <div id="view-badges" class="badge-list"></div>
                    <div id="view-details-list" class="details-list-container"></div>
                </div>

                <div class="legend-panel">
                    <div class="legend-item"><span class="legend-color-box" style="background: #22c55e;"></span> VERDE</div>
                    <div class="legend-item"><span class="legend-color-box" style="background: #facc15;"></span> COD GALBEN</div>
                    <div class="legend-item"><span class="legend-color-box" style="background: #f97316;"></span> COD PORTOCALIU</div>
                    <div class="legend-item"><span class="legend-color-box" style="background: #ef4444;"></span> COD ROȘU</div>
                </div>

                <div id="meteo-viewer-map" class="map-frame"></div>
            </div>
        `;
    }

    loadLeafletAndInit(jsonSrc) {
        if (window.L) {
            this.initWidgetMap(jsonSrc);
        } else {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => this.initWidgetMap(jsonSrc);
            document.head.appendChild(script);
        }
    }

    initWidgetMap(jsonSrc) {
        const mapElem = this.shadowRoot.getElementById('meteo-viewer-map');
        if (!mapElem) return;

        const colors = { 0: '#22c55e', 1: '#facc15', 2: '#f97316', 3: '#ef4444' };
        const statusTexts = { 0: 'VERDE', 1: 'COD GALBEN', 2: 'COD PORTOCALIU', 3: 'COD ROȘU' };

        const map = L.map(mapElem, {
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0.1,
            zoomDelta: 0.5,
            wheelPxPerZoomLevel: 120
        }).setView([47.0105, 28.8638], 7.8);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        fetch(jsonSrc)
            .then(res => res.json())
            .then(payload => {
                const warnings = payload.warnings || [];
                const geoData = payload.geoData;

                this.resetToGlobalSummary(warnings, colors);

                const geoLayer = L.geoJSON(geoData, {
                    style: (feature) => {
                        const warn = feature.properties.meteo_warn || 0;
                        return {
                            weight: 1.2,
                            opacity: 0.9,
                            color: '#ffffff',
                            fillColor: colors[warn] || colors[0],
                            fillOpacity: 0.75
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const name = feature.properties.NAMN || feature.properties.DENUMIRE || 'Raion';
                        const districtWarnings = feature.properties.warnings_list || [];
                        const warnLevel = feature.properties.meteo_warn || 0;

                        layer.bindTooltip(name, { permanent: false, direction: 'center' });

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                l.setStyle({ weight: 2.5, color: '#000000', fillOpacity: 0.95 });
                                l.bringToFront();
                                this.showDistrictMultiDetails(name, warnLevel, districtWarnings, colors, statusTexts);
                            },
                            mouseout: (e) => {
                                geoLayer.resetStyle(e.target);
                                this.resetToGlobalSummary(warnings, colors);
                            }
                        });
                    }
                }).addTo(map);

                if (geoData.features && geoData.features.length > 0) {
                    map.fitBounds(geoLayer.getBounds());
                }
            })
            .catch(err => console.error('Error loading meteo warning JSON:', err));
    }

    showDistrictMultiDetails(districtName, maxWarnLevel, warningsList, colors, statusTexts) {
        const badgeContainer = this.shadowRoot.getElementById('view-badges');
        const detailsContainer = this.shadowRoot.getElementById('view-details-list');

        if (!warningsList || warningsList.length === 0) {
            badgeContainer.innerHTML = `<div class="badge"><span class="dot" style="background:${colors[0]}"></span> <strong>${districtName}</strong>: VERDE</div>`;
            detailsContainer.innerHTML = `<p class="viewer-description">În raionul ${districtName} nu sunt prognozate fenomene meteorologice periculoase.</p>`;
            return;
        }

        badgeContainer.innerHTML = warningsList.map(w => `
            <div class="badge" style="border-color:${colors[w.level]};">
                <span class="dot" style="background:${colors[w.level]}"></span> 
                ${w.icon || ''} <strong>${districtName}</strong>: ${statusTexts[w.level]} (${w.phenomena})
            </div>
        `).join('');

        detailsContainer.innerHTML = warningsList.map(w => `
            <div class="warning-detail-card level-${w.level}">
                <div class="detail-head">
                    <span>${w.icon || ''} <strong>${w.phenomena}</strong></span>
                    <span class="detail-badge" style="background:${colors[w.level]}">${statusTexts[w.level]}</span>
                </div>
                <div class="detail-meta">
                    Data emiterii: <strong>${w.issueDate}</strong><br>
                    Intervalul de acțiune: <strong>${w.interval}</strong>
                </div>
                <p class="detail-text">${w.description}</p>
            </div>
        `).join('');
    }

    resetToGlobalSummary(warnings, colors) {
        const badgeContainer = this.shadowRoot.getElementById('view-badges');
        const detailsContainer = this.shadowRoot.getElementById('view-details-list');

        if (!warnings || warnings.length === 0) {
            badgeContainer.innerHTML = `<div class="badge"><span class="dot" style="background:${colors[0]}"></span> VERDE</div>`;
            detailsContainer.innerHTML = '<p class="viewer-description">În prezent nu sunt prognozate fenomene meteorologice periculoase.</p>';
            return;
        }

        const usedLevels = new Set(warnings.map(w => w.level));
        let badgesHtml = '';
        if (usedLevels.has(1)) badgesHtml += `<div class="badge"><span class="dot" style="background:${colors[1]}"></span> COD GALBEN</div>`;
        if (usedLevels.has(2)) badgesHtml += `<div class="badge"><span class="dot" style="background:${colors[2]}"></span> COD PORTOCALIU</div>`;
        if (usedLevels.has(3)) badgesHtml += `<div class="badge"><span class="dot" style="background:${colors[3]}"></span> COD ROȘU</div>`;

        badgeContainer.innerHTML = badgesHtml;
        detailsContainer.innerHTML = '<p class="viewer-description">Наведите курсор на любой район на карте, чтобы посмотреть его персональные предупреждения и параметры.</p>';
    }
}

customElements.define('meteo-alarm-widget', MeteoAlarmWidget);