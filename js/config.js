const MeteoConfig = {
    geojsonPath: 'data/map.geojson',
    mapCenter: [47.0105, 28.8638],
    defaultZoom: 7.8,

    colors: {
        0: '#22c55e',
        1: '#facc15',
        2: '#f97316',
        3: '#ef4444'
    },

    statusTexts: {
        0: 'VERDE',
        1: 'COD GALBEN',
        2: 'COD PORTOCALIU',
        3: 'COD ROȘU'
    },

    phenomenaTypes: {
        wind: { title: "Intensificări ale vântului / Vijelie", icon: "💨" },
        rain: { title: "Ploi puternice / Averse", icon: "🌧️" },
        thunderstorm: { title: "Descărcări electrice", icon: "⚡" },
        hail: { title: "Grindină", icon: "🧊" },
        heat: { title: "Caniculă (Temperaturi înalte)", icon: "🌡️" },
        frost: { title: "Înghețuri / Ger", icon: "❄️" },
        fog: { title: "Ceață", icon: "🌫️" },
        snow_ice: { title: "Ninsori / Polei / Ghețuș / Viscol", icon: "🌨️" },
        fire: { title: "Pericol excepțional de incendiu", icon: "🔥" }
    },

    polygonStyle: {
        weight: 1.2,
        opacity: 0.9,
        color: '#ffffff',
        fillOpacity: 0.75
    },

    selectedStyle: {
        weight: 3,
        color: '#0284c7',
        fillOpacity: 0.85
    }
};