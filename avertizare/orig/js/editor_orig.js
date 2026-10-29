const PLAIN_PASSWORD = "meteo2026";
const PASSWORD_HASH = "f9a4fa145ee2b144572f6a9c1dd430032b4fef0052db50e18f2195f082e668c2";

/* ==========================================================================
   АВТОРИЗАЦИЯ И БЕЗОПАСНОСТЬ
   ========================================================================== */

async function hashPassword(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAuth() {
    const inputPass = document.getElementById('auth-password-input').value;
    const inputField = document.getElementById('auth-password-input');

    if (!inputPass) {
        showAuthError("Введите пароль!");
        return;
    }

    const hashedInput = await hashPassword(inputPass);

    if (inputPass.trim() === PLAIN_PASSWORD || hashedInput === PASSWORD_HASH) {
        sessionStorage.setItem('meteo_editor_auth', 'true');
        
        const overlay = document.getElementById('auth-modal-overlay');
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            overlay.style.display = 'none';
            initEditorApp();
        }, 300);
    } else {
        showAuthError("Неверный пароль доступа!");
        inputField.value = '';
        inputField.focus();
    }
}

function showAuthError(msg) {
    const errorElem = document.getElementById('auth-error-msg');
    const card = document.querySelector('.auth-card');
    
    errorElem.innerText = msg;
    errorElem.style.display = "block";

    if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
    }
}

function checkAuthStatus() {
    const isAuth = sessionStorage.getItem('meteo_editor_auth');
    if (isAuth === 'true') {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        initEditorApp();
    } else {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) overlay.style.display = 'flex';
    }
}

function logoutEditor() {
    sessionStorage.removeItem('meteo_editor_auth');
    location.reload();
}

/* ==========================================================================
   ОСНОВНАЯ ЛОГИКА РЕДАКТОРА
   ========================================================================== */

let rawGeoData = null;
let geojsonLayer = null;
let selectedDistrictIds = new Set();
let isSpacePressed = false;

let activeWarnings = [];
let draftWarnings = [];
let editingDraftId = null;

const DESCRIPTIONS_BY_PHENOMENA = {
    "wind": "Se prevăd intensificări ale vântului nord-estic în rafale de până la 15-20 m/s.",
    "rain": "Vor cădea ploi însemnate cantitativ (15-49 l/m² în interval de 12 ore sau mai puțin).",
    "thunderstorm": "Se prevăd descărcări electrice, izolat ploi de scurtă durată cu grindină și vijelie.",
    "hail": "Izolat se prevede grindină cu diametrul de 10-20 mm și descărcări electrice frecvente.",
    "heat": "Temperatura maximă a aerului va atinge valori cuprinse între +33°C și +35°C.",
    "frost": "În orele nocturne și ale dimineții se prevăd înghețuri la suprafața solului (-1..-3°C).",
    "fog": "Se prevede ceață cu vizibilitatea de 200-500 m, izolat sub 100 m.",
    "snow_ice": "Se prevede depunere de polei pe firele electrice și copaci, pe drumuri ghețuș.",
    "fire": "Se va menține pericol excepțional de incendiu (clasa V) cu caracter natural."
};

function onPhenomenaChange(key) {
    const textElem = document.getElementById('meta-text');
    if (DESCRIPTIONS_BY_PHENOMENA[key]) {
        textElem.value = DESCRIPTIONS_BY_PHENOMENA[key];
    }
}

// Автоматическая подгрузка действующих предупреждений с сервера
function autoFetchActiveWarnings() {
    fetch('data/meteo_warning_active.json?t=' + Date.now())
        .then(res => {
            if (!res.ok) throw new Error('No active file');
            return res.json();
        })
        .then(payload => {
            if (payload.warnings && Array.isArray(payload.warnings)) {
                // Фильтруем истекшие предупреждения (по желанию), оставляем актуальные
                activeWarnings = payload.warnings;
                syncWarningsWithGeoData();
                renderWarningsList();
                if (geojsonLayer) geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
            }
        })
        .catch(err => {
            console.log('Активный файл предупреждений пока отсутствует или не доступен:', err.message);
        });
}

function syncWarningsWithGeoData() {
    if (!rawGeoData || !rawGeoData.features) return;
    rawGeoData.features.forEach(f => {
        const id = f.properties.OBJECTID || f.properties.NAMN || f.properties.DENUMIRE;
        f.properties.warnings_list = [];
        
        activeWarnings.forEach(w => {
            if (w.districts.includes(id)) {
                f.properties.warnings_list.push(w);
            }
        });

        if (f.properties.warnings_list.length > 0) {
            f.properties.meteo_warn = Math.max(...f.properties.warnings_list.map(w => w.level));
        } else {
            f.properties.meteo_warn = 0;
        }
    });
}

function formatDisplayDate(startIso, endIso) {
    if (!startIso || !endIso) return "-";
    const startDate = new Date(startIso);
    const endDate = new Date(endIso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(startDate.getDate())}.${pad(startDate.getMonth() + 1)} (${pad(startDate.getHours())}:${pad(startDate.getMinutes())}) – ${pad(endDate.getDate())}.${pad(endDate.getMonth() + 1)} (${pad(endDate.getHours())}:${pad(endDate.getMinutes())})`;
}

function formatIssueDate(issueIso) {
    if (!issueIso) return "-";
    const d = new Date(issueIso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ora ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addWarningDraft() {
    if (selectedDistrictIds.size === 0) {
        alert('Сначала выделите районы на карте (через Пробел или кликами)!');
        return;
    }

    const warnLevel = parseInt(document.getElementById('meta-level').value, 10);
    const phenKey = document.getElementById('meta-phenomena').value;
    const phenObj = MeteoConfig.phenomenaTypes[phenKey] || { title: "Avertizare", icon: "⚠️" };

    const rawIssue = document.getElementById('meta-issue-date').value;
    const rawStart = document.getElementById('meta-start-date').value;
    const rawEnd = document.getElementById('meta-end-date').value;

    const draftObj = {
        id: editingDraftId || 'draft_' + Date.now(),
        level: warnLevel,
        typeKey: phenKey,
        phenomena: phenObj.title,
        icon: phenObj.icon,
        rawIssue: rawIssue,
        rawStart: rawStart,
        rawEnd: rawEnd,
        issueDate: formatIssueDate(rawIssue),
        interval: formatDisplayDate(rawStart, rawEnd),
        expiresAt: rawEnd ? new Date(rawEnd).toISOString() : null,
        description: document.getElementById('meta-text').value,
        districts: Array.from(selectedDistrictIds)
    };

    if (editingDraftId) {
        const index = draftWarnings.findIndex(d => d.id === editingDraftId);
        if (index !== -1) draftWarnings[index] = draftObj;
        editingDraftId = null;
    } else {
        draftWarnings.push(draftObj);
    }

    selectedDistrictIds.clear();
    updateSelectedInfoText();
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function editDraft(draftId) {
    const draft = draftWarnings.find(d => d.id === draftId);
    if (!draft) return;

    editingDraftId = draft.id;
    document.getElementById('meta-level').value = draft.level;
    document.getElementById('meta-phenomena').value = draft.typeKey;
    document.getElementById('meta-issue-date').value = draft.rawIssue;
    document.getElementById('meta-start-date').value = draft.rawStart;
    document.getElementById('meta-end-date').value = draft.rawEnd;
    document.getElementById('meta-text').value = draft.description;

    selectedDistrictIds = new Set(draft.districts);
    updateSelectedInfoText();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function deleteDraft(draftId) {
    draftWarnings = draftWarnings.filter(d => d.id !== draftId);
    if (editingDraftId === draftId) editingDraftId = null;

    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function clearAllDrafts() {
    draftWarnings = [];
    editingDraftId = null;
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function recalculatePreviewStyles() {
    rawGeoData.features.forEach(f => {
        const id = f.properties.OBJECTID || f.properties.NAMN || f.properties.DENUMIRE;
        const matchedDrafts = draftWarnings.filter(d => d.districts.includes(id));

        if (matchedDrafts.length > 0) {
            f.properties.preview_warn = Math.max(...matchedDrafts.map(d => d.level));
        } else {
            delete f.properties.preview_warn;
        }
    });
}

function renderDraftsPanelUI() {
    const panel = document.getElementById('draft-preview-panel');
    const container = document.getElementById('drafts-list-container');
    const countElem = document.getElementById('drafts-count');

    if (draftWarnings.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    countElem.innerText = draftWarnings.length;

    container.innerHTML = draftWarnings.map((d, index) => `
        <div class="draft-item level-${d.level}">
            <div class="draft-item-header">
                <strong>${d.icon} #${index + 1} ${MeteoConfig.statusTexts[d.level]}</strong>
                <div class="draft-item-actions">
                    <button class="draft-icon-btn" onclick="editDraft('${d.id}')" title="Редактировать">✏️</button>
                    <button class="draft-icon-btn delete" onclick="deleteDraft('${d.id}')" title="Удалить">🗑️</button>
                </div>
            </div>
            <div class="draft-item-body">
                <b>Явление:</b> ${d.phenomena}<br>
                <b>Районов:</b> ${d.districts.length} | <b>Период:</b> ${d.interval}
            </div>
        </div>
    `).join('');
}

function saveAllDraftsToFinal() {
    if (draftWarnings.length === 0) {
        alert('У вас нет несохраненных черновиков!');
        return;
    }

    draftWarnings.forEach(draft => {
        const finalWarning = {
            ...draft,
            id: 'warn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
        };

        activeWarnings.push(finalWarning);
    });

    syncWarningsWithGeoData();

    draftWarnings = [];
    selectedDistrictIds.clear();
    editingDraftId = null;

    recalculatePreviewStyles();
    renderDraftsPanelUI();
    updateSelectedInfoText();
    renderWarningsList();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function removeWarning(warnId) {
    activeWarnings = activeWarnings.filter(w => w.id !== warnId);
    syncWarningsWithGeoData();
    renderWarningsList();
    geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
}

function renderWarningsList() {
    const container = document.getElementById('warnings-tree');
    if (!container) return;

    if (activeWarnings.length === 0) {
        container.innerHTML = '<div style="font-size:11px; color:#94a3b8;">Нет сохраненных предупреждений</div>';
        return;
    }

    container.innerHTML = activeWarnings.map((w, index) => `
        <div class="warning-item level-${w.level}">
            <div class="warning-item-header">
                <strong>${w.icon} #${index + 1} ${MeteoConfig.statusTexts[w.level]}</strong>
                <button onclick="removeWarning('${w.id}')" class="delete-warn-btn">✕</button>
            </div>
            <div style="font-size:11px; margin-top:2px;"><b>Явление:</b> ${w.phenomena}</div>
            <div style="font-size:10px; color:#64748b;"><b>Районов:</b> ${w.districts.length} | <b>Период:</b> ${w.interval}</div>
        </div>
    `).join('');
}

function updateSelectedInfoText() {
    const infoContainer = document.getElementById('selected-count');
    infoContainer.innerText = selectedDistrictIds.size === 0 
        ? 'Ничего не выбрано' 
        : `Выбрано районов: ${selectedDistrictIds.size}`;
}

function exportWarningJSON() {
    if (!rawGeoData) return;

    const payload = {
        generatedAt: new Date().toISOString(),
        warnings: activeWarnings,
        geoData: rawGeoData
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "meteo_warning_active.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function initEditorApp() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            if (!isSpacePressed) {
                isSpacePressed = true;
                const mapContainer = document.getElementById('meteo-map');
                if (mapContainer) mapContainer.classList.add('space-selecting');
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpacePressed = false;
            const mapContainer = document.getElementById('meteo-map');
            if (mapContainer) mapContainer.classList.remove('space-selecting');
        }
    });

    const now = new Date();
    const nowPlus12 = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    document.getElementById('meta-issue-date').value = toLocalISO(now);
    document.getElementById('meta-start-date').value = toLocalISO(now);
    document.getElementById('meta-end-date').value = toLocalISO(nowPlus12);

    onPhenomenaChange(document.getElementById('meta-phenomena').value);

    const map = L.map('meteo-map', {
        zoomControl: true,
        attributionControl: false,
        boxZoom: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120
    }).setView(MeteoConfig.mapCenter, MeteoConfig.defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    function getColor(warnLevel) {
        return MeteoConfig.colors[parseInt(warnLevel, 10)] || MeteoConfig.colors[0];
    }

    function style(feature) {
        const id = feature.properties.OBJECTID || feature.properties.NAMN || feature.properties.DENUMIRE;
        const isSelected = selectedDistrictIds.has(id);
        const warn = feature.properties.preview_warn || feature.properties.meteo_warn || 0;

        return {
            ...MeteoConfig.polygonStyle,
            fillColor: getColor(warn),
            ...(isSelected ? MeteoConfig.selectedStyle : {})
        };
    }

    function onEachFeature(feature, layer) {
        const id = feature.properties.OBJECTID || feature.properties.NAMN || feature.properties.DENUMIRE;
        const name = feature.properties.NAMN || feature.properties.DENUMIRE || 'Район';

        layer.bindTooltip(name, { permanent: false, direction: 'center' });

        layer.on('click', (e) => {
            if (!isSpacePressed) {
                if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
                    if (selectedDistrictIds.has(id)) selectedDistrictIds.delete(id);
                    else selectedDistrictIds.add(id);
                } else {
                    selectedDistrictIds.clear();
                    selectedDistrictIds.add(id);
                }
                updateSelectedInfoText();
                geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
            }
        });
    }

    function stripZCoords(coords) {
        if (typeof coords[0] === 'number') return [coords[0], coords[1]];
        return coords.map(stripZCoords);
    }

    let isMouseDown = false;
    let startLatLng = null;
    let selectionBox = null;

    map.on('mousedown', (e) => {
        if (!isSpacePressed) return;
        isMouseDown = true;
        startLatLng = e.latlng;
        map.dragging.disable();

        if (selectionBox) {
            map.removeLayer(selectionBox);
            selectionBox = null;
        }

        selectionBox = L.rectangle([startLatLng, startLatLng], {
            color: '#0284c7',
            weight: 2,
            fillColor: '#38bdf8',
            fillOpacity: 0.3,
            dashArray: '4, 4'
        }).addTo(map);
    });

    map.on('mousemove', (e) => {
        if (!isMouseDown || !selectionBox || !startLatLng) return;
        selectionBox.setBounds(L.latLngBounds(startLatLng, e.latlng));
    });

    map.on('mouseup', (e) => {
        if (!isMouseDown) return;
        isMouseDown = false;
        map.dragging.enable();

        if (selectionBox) {
            const bounds = selectionBox.getBounds();
            map.removeLayer(selectionBox);
            selectionBox = null;

            if (!e.originalEvent.ctrlKey && !e.originalEvent.metaKey) {
                selectedDistrictIds.clear();
            }

            geojsonLayer.eachLayer(layer => {
                if (bounds.intersects(layer.getBounds())) {
                    const id = layer.feature.properties.OBJECTID || layer.feature.properties.NAMN || layer.feature.properties.DENUMIRE;
                    selectedDistrictIds.add(id);
                }
            });

            updateSelectedInfoText();
            geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
        }
    });

    fetch(MeteoConfig.geojsonPath)
        .then(response => response.json())
        .then(data => {
            rawGeoData = data;
            rawGeoData.features.forEach(f => {
                if (f.geometry && f.geometry.coordinates) {
                    f.geometry.coordinates = stripZCoords(f.geometry.coordinates);
                }
                if (f.properties.meteo_warn === undefined) {
                    f.properties.meteo_warn = 0;
                }
            });

            geojsonLayer = L.geoJSON(rawGeoData, {
                style: style,
                onEachFeature: onEachFeature
            }).addTo(map);

            if (rawGeoData.features && rawGeoData.features.length > 0) {
                map.fitBounds(geojsonLayer.getBounds());
            }

            // ПОСЛЕ ЗАГРУЗКИ ГЕОМЕТРИИ АВТОМАТИЧЕСКИ ПОДТЯГИВАЕМ АКТИВНЫЙ JSON
            autoFetchActiveWarnings();
        })
        .catch(err => console.error('Ошибка GeoJSON:', err));
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);