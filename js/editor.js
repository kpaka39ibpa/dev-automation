(function(){const _0x1a2b=function(){let _0x3f12=!![];return function(_0x4b89,_0x2d1a){const _0x5c31=_0x3f12?function(){if(_0x2d1a){const _0x11e2=_0x2d1a.apply(_0x4b89,arguments);_0x2d1a=null;return _0x11e2;}}:function(){};_0x3f12=![];return _0x5c31;};}();const _0x2c4e=_0x1a2b(this,function(){return _0x2c4e.toString().search('(((.+)+)+)+$').toString().constructor(_0x2c4e).search('(((.+)+)+)+$');});_0x2c4e();})();

document.addEventListener('contextmenu',_0x5a1f=>_0x5a1f.preventDefault());
document.addEventListener('keydown',_0x3b8d=>{if(_0x3b8d.keyCode===123||(_0x3b8d.ctrlKey&&_0x3b8d.shiftKey&&(_0x3b8d.keyCode===73||_0x3b8d.keyCode===74))||(_0x3b8d.ctrlKey&&_0x3b8d.keyCode===85)){_0x3b8d.preventDefault();return![];}});

const PLAIN_PASSWORD="meteo2026";
const PASSWORD_HASH="f9a4fa145ee2b144572f6a9c1dd430032b4fef0052db50e18f2195f082e668c2";

async function hashPassword(_0x52a1){
    const _0x14b2=new TextEncoder();
    const _0x291d=_0x14b2.encode(_0x52a1.trim());
    const _0x38e1=await crypto.subtle.digest('SHA-256',_0x291d);
    return Array.from(new Uint8Array(_0x38e1)).map(_0x4a2d=>_0x4a2d.toString(16).padStart(2,'0')).join('');
}

async function verifyAuth(){
    const _0x12d4=document.getElementById('auth-password-input').value;
    if(!_0x12d4){showAuthError("Введите пароль!");return;}
    const _0x241e=await hashPassword(_0x12d4);
    if(_0x12d4.trim()===PLAIN_PASSWORD||_0x241e===PASSWORD_HASH){
        sessionStorage.setItem('meteo_editor_auth','true');
        const _0x4c21=document.getElementById('auth-modal-overlay');
        _0x4c21.style.opacity='0';
        setTimeout(()=>{_0x4c21.style.display='none';initEditorApp();},300);
    }else{
        showAuthError("Неверный пароль доступа!");
    }
}

function showAuthError(_0x1a21){
    const _0x2b31=document.getElementById('auth-error-msg');
    _0x2b31.innerText=_0x1a21;
    _0x2b31.style.display="block";
}

function checkAuthStatus(){
    if(sessionStorage.getItem('meteo_editor_auth')==='true'){
        document.getElementById('auth-modal-overlay').style.display='none';
        initEditorApp();
    }else{
        document.getElementById('auth-modal-overlay').style.display='flex';
    }
}

function logoutEditor(){
    sessionStorage.removeItem('meteo_editor_auth');
    location.reload();
}

let rawGeoData=null,geojsonLayer=null,selectedDistrictIds=new Set(),isSpacePressed=![],activeWarnings=[],draftWarnings=[],editingDraftId=null;

const DESCRIPTIONS_BY_PHENOMENA={
    "wind":"Se prevăd intensificări ale vântului nord-estic în rafale de până la 15-20 m/s.",
    "rain":"Vor cădea ploi însemnate cantitativ (15-49 l/m² în interval de 12 ore sau mai puțin).",
    "thunderstorm":"Se prevăd descărcări electrice, izolat ploi de scurtă durată cu grindină și vijelie.",
    "hail":"Izolat se prevede grindină cu diametrul de 10-20 mm și descărcări electrice frecvente.",
    "heat":"Temperatura maximă a aerului va atinge valori cuprinse între +33°C și +35°C.",
    "frost":"În orele nocturne și ale dimineții se prevăd înghețuri la suprafața solului (-1..-3°C).",
    "fog":"Se prevede ceață cu vizibilitatea de 200-500 m, izolat sub 100 m.",
    "snow_ice":"Se prevede depunere de polei pe firele electrice și copaci, pe drumuri ghețuș.",
    "fire":"Se va menține pericol excepțional de incendiu (clasa V) cu caracter natural."
};

function onPhenomenaChange(_0x1c21){
    const _0x22a1=document.getElementById('meta-text');
    if(DESCRIPTIONS_BY_PHENOMENA[_0x1c21])_0x22a1.value=DESCRIPTIONS_BY_PHENOMENA[_0x1c21];
}

// Парсинг любой произвольной даты без завязаности на локаль браузера
function parseCustomDate(str) {
    if (!str) return new Date();
    const cleanStr = str.replace('T', ' ').trim();
    const parts = cleanStr.split(' ');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1] ? parts[1].split(':') : [0, 0];

    return new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10)
    );
}

// Автоматическое удаление истекших предупреждений по времени
function purgeExpiredWarnings(){
    const now = Date.now();
    const initialCount = activeWarnings.length;
    activeWarnings = activeWarnings.filter(w => {
        const endTimeStr = w.rawEnd || w.expiresAt;
        if (!endTimeStr) return true;
        const endTime = parseCustomDate(endTimeStr).getTime();
        return endTime > now;
    });
    
    if (activeWarnings.length !== initialCount) {
        syncWarningsWithGeoData();
        renderWarningsList();
        if (geojsonLayer) {
            geojsonLayer.eachLayer(_0x14e1 => geojsonLayer.resetStyle(_0x14e1));
        }
    }
}

function autoFetchActiveWarnings(){
    fetch('data/meteo_warning_active.json?t='+Date.now())
        .then(_0x12a3=>_0x12a3.json())
        .then(_0x33b1=>{
            if(_0x33b1.warnings&&Array.isArray(_0x33b1.warnings)){
                activeWarnings=_0x33b1.warnings;
                purgeExpiredWarnings();
                syncWarningsWithGeoData();
                renderWarningsList();
                if(geojsonLayer)geojsonLayer.eachLayer(_0x14e1=>geojsonLayer.resetStyle(_0x14e1));
            }
        })
        .catch(_0x21a4=>{});
}

function syncWarningsWithGeoData(){
    if(!rawGeoData||!rawGeoData.features)return;
    rawGeoData.features.forEach(_0x3f12=>{
        const _0x12d3=_0x3f12.properties.OBJECTID||_0x3f12.properties.NAMN||_0x3f12.properties.DENUMIRE;
        _0x3f12.properties.warnings_list=[];
        activeWarnings.forEach(_0x4e21=>{
            if(_0x4e21.districts.includes(_0x12d3))_0x3f12.properties.warnings_list.push(_0x4e21);
        });
        if(_0x3f12.properties.warnings_list.length>0){
            _0x3f12.properties.meteo_warn=Math.max(..._0x3f12.properties.warnings_list.map(_0x112a=>_0x112a.level));
        }else{
            _0x3f12.properties.meteo_warn=0;
        }
    });
}

// Форматирование строго 24-часовой строки без AM/PM
function formatDisplayDate(_0x12b1, _0x2c31){
    if (!_0x12b1 || !_0x2c31) return "-";
    const start = parseCustomDate(_0x12b1);
    const end = parseCustomDate(_0x2c31);
    const pad = n => String(n).padStart(2, '0');

    const startStr = `${pad(start.getDate())}.${pad(start.getMonth() + 1)} (${pad(start.getHours())}:${pad(start.getMinutes())})`;
    const endStr = `${pad(end.getDate())}.${pad(end.getMonth() + 1)} (${pad(end.getHours())}:${pad(end.getMinutes())})`;

    return `${startStr} – ${endStr}`;
}

function formatIssueDate(_0x14e2){
    if (!_0x14e2) return "-";
    const d = parseCustomDate(_0x14e2);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ora ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addWarningDraft(){
    if(selectedDistrictIds.size===0){alert('Сначала выделите районы на карте!');return;}
    const _0x1e24=parseInt(document.getElementById('meta-level').value,10),
          _0x2b1e=document.getElementById('meta-phenomena').value,
          _0x3a21=MeteoConfig.phenomenaTypes[_0x2b1e]||{title:"Avertizare",icon:"⚠️"},
          _0x11d2=document.getElementById('meta-issue-date').value,
          _0x2a13=document.getElementById('meta-start-date').value,
          _0x4c21=document.getElementById('meta-end-date').value,
          _0x1f24={
              id:editingDraftId||'draft_'+Date.now(),
              level:_0x1e24,
              typeKey:_0x2b1e,
              phenomena:_0x3a21.title,
              icon:_0x3a21.icon,
              rawIssue:_0x11d2,
              rawStart:_0x2a13,
              rawEnd:_0x4c21,
              issueDate:formatIssueDate(_0x11d2),
              interval:formatDisplayDate(_0x2a13,_0x4c21),
              expiresAt:_0x4c21 ? parseCustomDate(_0x4c21).toISOString() : null,
              description:document.getElementById('meta-text').value,
              districts:Array.from(selectedDistrictIds)
          };

    if(editingDraftId){
        const _0x21c2=draftWarnings.findIndex(_0x1e21=>_0x1e21.id===editingDraftId);
        if(_0x21c2!==-1)draftWarnings[_0x21c2]=_0x1f24;
        editingDraftId=null;
    }else draftWarnings.push(_0x1f24);

    selectedDistrictIds.clear();
    updateSelectedInfoText();
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(_0x14b1=>geojsonLayer.resetStyle(_0x14b1));
}

function editDraft(_0x12a4){
    const _0x33b1=draftWarnings.find(_0x1a23=>_0x1a23.id===_0x12a4);
    if(!_0x33b1)return;
    editingDraftId=_0x33b1.id;
    document.getElementById('meta-level').value=_0x33b1.level;
    document.getElementById('meta-phenomena').value=_0x33b1.typeKey;
    document.getElementById('meta-issue-date').value=_0x33b1.rawIssue;
    document.getElementById('meta-start-date').value=_0x33b1.rawStart;
    document.getElementById('meta-end-date').value=_0x33b1.rawEnd;
    document.getElementById('meta-text').value=_0x33b1.description;
    selectedDistrictIds=new Set(_0x33b1.districts);
    updateSelectedInfoText();
    geojsonLayer.eachLayer(_0x14e1=>geojsonLayer.resetStyle(_0x14e1));
}

function deleteDraft(_0x1f23){
    draftWarnings=draftWarnings.filter(_0x2c12=>_0x2c12.id!==_0x1f23);
    if(editingDraftId===_0x1f23)editingDraftId=null;
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(_0x1a23=>geojsonLayer.resetStyle(_0x1a23));
}

function clearAllDrafts(){
    draftWarnings=[];
    editingDraftId=null;
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    geojsonLayer.eachLayer(_0x2e12=>geojsonLayer.resetStyle(_0x2e12));
}

function recalculatePreviewStyles(){
    rawGeoData.features.forEach(_0x12e1=>{
        const _0x2a14=_0x12e1.properties.OBJECTID||_0x12e1.properties.NAMN||_0x12e1.properties.DENUMIRE,
              _0x3f12=draftWarnings.filter(_0x1b23=>_0x1b23.districts.includes(_0x2a14));
        if(_0x3f12.length>0)_0x12e1.properties.preview_warn=Math.max(..._0x3f12.map(_0x212a=>_0x212a.level));
        else delete _0x12e1.properties.preview_warn;
    });
}

function renderDraftsPanelUI(){
    const _0x12f1=document.getElementById('draft-preview-panel'),
          _0x2c31=document.getElementById('drafts-list-container'),
          _0x4e12=document.getElementById('drafts-count');
    if(draftWarnings.length===0){_0x12f1.style.display='none';return;}
    _0x12f1.style.display='block';
    _0x4e12.innerText=draftWarnings.length;
    _0x2c31.innerHTML=draftWarnings.map((_0x1a23,_0x2b1e)=>'<div class="draft-item level-'+_0x1a23.level+'"><div class="draft-item-header"><strong>'+_0x1a23.icon+' #'+(_0x2b1e+1)+' '+MeteoConfig.statusTexts[_0x1a23.level]+'</strong><div class="draft-item-actions"><button class="draft-icon-btn" onclick="editDraft(\''+_0x1a23.id+'\')">✏️</button><button class="draft-icon-btn delete" onclick="deleteDraft(\''+_0x1a23.id+'\')">🗑️</button></div></div><div class="draft-item-body"><b>Явление:</b> '+_0x1a23.phenomena+'<br><b>Районов:</b> '+_0x1a23.districts.length+' | <b>Период:</b> '+_0x1a23.interval+'</div></div>').join('');
}

function saveAllDraftsToFinal(){
    if(draftWarnings.length===0){alert('У вас нет черновиков!');return;}
    draftWarnings.forEach(_0x21a2=>{
        activeWarnings.push({..._0x21a2,id:'warn_'+Date.now()+'_'+Math.random().toString(36).substr(2,4)});
    });
    purgeExpiredWarnings();
    syncWarningsWithGeoData();
    draftWarnings=[];
    selectedDistrictIds.clear();
    editingDraftId=null;
    recalculatePreviewStyles();
    renderDraftsPanelUI();
    updateSelectedInfoText();
    renderWarningsList();
    geojsonLayer.eachLayer(_0x12a3=>geojsonLayer.resetStyle(_0x12a3));
}

function removeWarning(_0x2c12){
    activeWarnings=activeWarnings.filter(_0x12b1=>_0x12b1.id!==_0x2c12);
    syncWarningsWithGeoData();
    renderWarningsList();
    geojsonLayer.eachLayer(_0x3e12=>geojsonLayer.resetStyle(_0x3e12));
}

function renderWarningsList(){
    const _0x12d4=document.getElementById('warnings-tree');
    if(!_0x12d4)return;
    if(activeWarnings.length===0){
        _0x12d4.innerHTML='<div style="font-size:11px; color:#94a3b8;">Нет сохраненных предупреждений</div>';
        return;
    }
    _0x12d4.innerHTML=activeWarnings.map((_0x1a23,_0x2b1e)=>'<div class="warning-item level-'+_0x1a23.level+'"><div class="warning-item-header"><strong>'+_0x1a23.icon+' #'+(_0x2b1e+1)+' '+MeteoConfig.statusTexts[_0x1a23.level]+'</strong><button onclick="removeWarning(\''+_0x1a23.id+'\')" class="delete-warn-btn">✕</button></div><div style="font-size:11px; margin-top:2px;"><b>Явление:</b> '+_0x1a23.phenomena+'</div><div style="font-size:10px; color:#64748b;"><b>Районов:</b> '+_0x1a23.districts.length+' | <b>Период:</b> '+_0x1a23.interval+'</div></div>').join('');
}

function updateSelectedInfoText(){
    document.getElementById('selected-count').innerText=selectedDistrictIds.size===0?'Ничего не выбрано':`Выбрано районов: ${selectedDistrictIds.size}`;
}

function exportWarningJSON(){
    if(!rawGeoData)return;
    purgeExpiredWarnings();
    const _0x12f1={generatedAt:new Date().toISOString(),warnings:activeWarnings,geoData:rawGeoData},
          _0x33b1="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(_0x12f1,null,2)),
          _0x1a23=document.createElement('a');
    _0x1a23.setAttribute("href",_0x33b1);
    _0x1a23.setAttribute("download","meteo_warning_active.json");
    document.body.appendChild(_0x1a23);
    _0x1a23.click();
    _0x1a23.remove();
}

function initEditorApp(){
    window.addEventListener('keydown',_0x12a3=>{
        if(_0x12a3.code==='Space'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
            _0x12a3.preventDefault();
            if(!isSpacePressed){
                isSpacePressed=!![];
                const _0x2b12=document.getElementById('meteo-map');
                if(_0x2b12)_0x2b12.classList.add('space-selecting');
            }
        }
    });
    window.addEventListener('keyup',_0x34b1=>{
        if(_0x34b1.code==='Space'){
            isSpacePressed=![];
            const _0x12a2=document.getElementById('meteo-map');
            if(_0x12a2)_0x12a2.classList.remove('space-selecting');
        }
    });

    // Дефолтные значения дат при старте
    const now = new Date();
    const future = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const to24String = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    document.getElementById('meta-issue-date').value = to24String(now);
    document.getElementById('meta-start-date').value = to24String(now);
    document.getElementById('meta-end-date').value = to24String(future);

    onPhenomenaChange(document.getElementById('meta-phenomena').value);

    const _0x14f2=L.map('meteo-map',{zoomControl:!![],attributionControl:![],boxZoom:![],zoomSnap:0.1,zoomDelta:0.5,wheelPxPerZoomLevel:120}).setView(MeteoConfig.mapCenter,MeteoConfig.defaultZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(_0x14f2);

    function _0x21a3(_0x11a2){return MeteoConfig.colors[parseInt(_0x11a2,10)]||MeteoConfig.colors[0];}
    function _0x3e12(_0x1a23){
        const _0x2b1e=_0x1a23.properties.OBJECTID||_0x1a23.properties.NAMN||_0x1a23.properties.DENUMIRE,
              _0x1e21=selectedDistrictIds.has(_0x2b1e),
              _0x4c21=_0x1a23.properties.preview_warn||_0x1a23.properties.meteo_warn||0;
        return{...MeteoConfig.polygonStyle,fillColor:_0x21a3(_0x4c21),...(_0x1e21?MeteoConfig.selectedStyle:{})};
    }
    function _0x12b4(_0x1a23,_0x2b1e){
        const _0x1e21=_0x1a23.properties.OBJECTID||_0x1a23.properties.NAMN||_0x1a23.properties.DENUMIRE,
              _0x4c21=_0x1a23.properties.NAMN||_0x1a23.properties.DENUMIRE||'Район';
        _0x2b1e.bindTooltip(_0x4c21,{permanent:![],direction:'center'});
        _0x2b1e.on('click',_0x33a1=>{
            if(!isSpacePressed){
                if(_0x33a1.originalEvent.ctrlKey||_0x33a1.originalEvent.metaKey){
                    if(selectedDistrictIds.has(_0x1e21))selectedDistrictIds.delete(_0x1e21);
                    else selectedDistrictIds.add(_0x1e21);
                }else{
                    selectedDistrictIds.clear();
                    selectedDistrictIds.add(_0x1e21);
                }
                updateSelectedInfoText();
                geojsonLayer.eachLayer(_0x11a2=>geojsonLayer.resetStyle(_0x11a2));
            }
        });
    }
    function _0x2a1d(_0x12a3){
        if(typeof _0x12a3[0]==='number')return[_0x12a3[0],_0x12a3[1]];
        return _0x12a3.map(_0x2a1d);
    }

    let _0x2c12=![],_0x3e21=null,_0x1f24=null;
    _0x14f2.on('mousedown',_0x12a3=>{
        if(!isSpacePressed)return;
        _0x2c12=!![];
        _0x3e21=_0x12a3.latlng;
        _0x14f2.dragging.disable();
        if(_0x1f24){_0x14f2.removeLayer(_0x1f24);_0x1f24=null;}
        _0x1f24=L.rectangle([_0x3e21,_0x3e21],{color:'#0284c7',weight:2,fillColor:'#38bdf8',fillOpacity:0.3,dashArray:'4, 4'}).addTo(_0x14f2);
    });
    _0x14f2.on('mousemove',_0x33a1=>{
        if(!_0x2c12||!_0x1f24||!_0x3e21)return;
        _0x1f24.setBounds(L.latLngBounds(_0x3e21,_0x33a1.latlng));
    });
    _0x14f2.on('mouseup',_0x1e21=>{
        if(!_0x2c12)return;
        _0x2c12=![];
        _0x14f2.dragging.enable();
        if(_0x1f24){
            const _0x4c21=_0x1f24.getBounds();
            _0x14f2.removeLayer(_0x1f24);
            _0x1f24=null;
            if(!_0x1e21.originalEvent.ctrlKey&&!_0x1e21.originalEvent.metaKey)selectedDistrictIds.clear();
            geojsonLayer.eachLayer(_0x11a2=>{
                if(_0x4c21.intersects(_0x11a2.getBounds())){
                    const _0x2b1e=_0x11a2.feature.properties.OBJECTID||_0x11a2.feature.properties.NAMN||_0x11a2.feature.properties.DENUMIRE;
                    selectedDistrictIds.add(_0x2b1e);
                }
            });
            updateSelectedInfoText();
            geojsonLayer.eachLayer(_0x12a3=>geojsonLayer.resetStyle(_0x12a3));
        }
    });

    fetch(MeteoConfig.geojsonPath)
        .then(_0x34a1=>_0x34a1.json())
        .then(_0x12f1=>{
            rawGeoData=_0x12f1;
            rawGeoData.features.forEach(_0x1a23=>{
                if(_0x1a23.geometry&&_0x1a23.geometry.coordinates)_0x1a23.geometry.coordinates=_0x2a1d(_0x1a23.geometry.coordinates);
                if(_0x1a23.properties.meteo_warn===undefined)_0x1a23.properties.meteo_warn=0;
            });
            geojsonLayer=L.geoJSON(rawGeoData,{style:_0x3e12,onEachFeature:_0x12b4}).addTo(_0x14f2);
            if(rawGeoData.features&&rawGeoData.features.length>0)_0x14f2.fitBounds(geojsonLayer.getBounds());
            autoFetchActiveWarnings();
        })
        .catch(_0x12a3=>console.error('Ошибка GeoJSON:',_0x12a3));

    setInterval(purgeExpiredWarnings, 5000);
}

document.addEventListener('DOMContentLoaded',checkAuthStatus);