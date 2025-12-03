/**
 * ShoreSquad - Main Application
 * Features: Interactive Map, Weather Integration, Crew Management, Event System
 */

// ============================================
// CONFIGURATION & STATE MANAGEMENT
// ============================================

const config = {
    mapTileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapAttribution: '&copy; OpenStreetMap contributors',
    defaultLocation: { lat: 40.7128, lng: -74.0060 }, // NYC
    neaForecastApi: 'https://api.data.gov.sg/v1/environment/4-day-weather-forecast',
};

let appState = {
    map: null,
    userLocation: null,
    crews: [],
    events: [],
    markers: [],
    userMarker: null,
    nextCleanupParticipants: 0,
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('ShoreSquad App Initializing...');
    
    // Initialize non-blocking features in a safe order. Map may fail to load
    // if Leaflet is blocked or unavailable; guard so weather and UI still render.
    try {
        initializeMap();
    } catch (err) {
        console.warn('Map initialization failed, continuing without map:', err && err.message ? err.message : err);
        // Show an inline fallback message to the user in the map container
        try {
            const mapEl = document.getElementById('map');
            if (mapEl) {
                mapEl.innerHTML = '';
                const fallback = document.createElement('div');
                fallback.setAttribute('role', 'alert');
                fallback.style.padding = '24px';
                fallback.style.textAlign = 'center';
                fallback.style.color = '#2C3E50';
                fallback.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.95))';
                fallback.style.borderRadius = '8px';
                fallback.style.height = '100%';
                fallback.style.display = 'flex';
                fallback.style.flexDirection = 'column';
                fallback.style.justifyContent = 'center';
                fallback.style.alignItems = 'center';
                // Build an embeddable Google Maps iframe centered on the next cleanup or default to Pasir Ris
                const defaultLat = 1.381497;
                const defaultLng = 103.955574;
                let lat = defaultLat, lng = defaultLng, placeLabel = 'Pasir Ris';
                try {
                    if (appState && appState.events && appState.events.length > 0) {
                        lat = appState.events[0].lat || lat;
                        lng = appState.events[0].lng || lng;
                        placeLabel = appState.events[0].name || placeLabel;
                    }
                } catch (e) {
                    // ignore
                }

                const iframeSrc = `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;

                fallback.innerHTML = `
                    <div style="width:100%;height:100%;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;">
                        <div style="font-size:1.1rem;font-weight:700;color:#2C3E50;">${placeLabel} — Map (static)</div>
                        <div style="width:100%;height:320px;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                            <iframe src="${iframeSrc}" width="100%" height="100%" style="border:0;display:block;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map fallback - ${placeLabel}"></iframe>
                        </div>
                        <div style="font-size:0.95rem;color:#7f8c8d;max-width:600px;text-align:center;">We couldn't load the interactive map. This embedded map is a reliable fallback and links to Google Maps for directions or Street View.</div>
                        <div style="display:flex;gap:8px;margin-top:6px;">
                            <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="padding:8px 12px;border-radius:6px;background:#0077BE;color:#fff;text-decoration:none;">Open in Google Maps</a>
                            <button id="retryMapBtn" style="padding:8px 12px;border-radius:6px;border:1px solid #0077BE;background:transparent;color:#0077BE;cursor:pointer;">Retry Map</button>
                        </div>
                    </div>
                `;
                mapEl.appendChild(fallback);
                const retry = document.getElementById('retryMapBtn');
                if (retry) retry.addEventListener('click', () => {
                    try { mapEl.innerHTML = ''; initializeMap(); renderEvents(); } catch (e) { console.warn('Retry failed:', e); }
                });
            }
        } catch (e) {
            console.warn('Failed to render map fallback UI', e && e.message ? e.message : e);
        }
    }

    loadMockData();
    setupEventListeners();
    // Load weather early so the weather section updates even if map errors occur
    loadWeather();
    renderCrew();
    renderEvents();
    
    console.log('ShoreSquad App Ready! 🌊');
});

// ============================================
// MAP FUNCTIONALITY
// ============================================

function initializeMap() {
    // Initialize Leaflet map
    appState.map = L.map('map').setView(
        [config.defaultLocation.lat, config.defaultLocation.lng],
        12
    );
    
    // Add tile layer
    L.tileLayer(config.mapTileLayer, {
        attribution: config.mapAttribution,
        maxZoom: 19,
    }).addTo(appState.map);
    
    console.log('Map initialized');
}

function addBeachMarker(lat, lng, name, eventData) {
    const marker = L.marker([lat, lng], {
        title: name,
    }).addTo(appState.map);
    
    const popupContent = `
        <div style="font-weight: 500;">
            🏖️ ${name}
        </div>
        <div style="margin-top: 8px; font-size: 0.9em;">
            <p>📅 ${eventData.date}</p>
            <p>👥 ${eventData.participants} people</p>
            <button onclick="joinEvent('${eventData.id}')" style="
                background-color: #0077BE;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 8px;
            ">Join Event</button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    appState.markers.push(marker);
    
    return marker;
}

function userLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                appState.userLocation = { lat: latitude, lng: longitude };
                
                // Remove old marker if exists
                if (appState.userMarker) {
                    appState.map.removeLayer(appState.userMarker);
                }
                
                // Add new marker
                appState.userMarker = L.marker([latitude, longitude], {
                    title: 'Your Location',
                }).addTo(appState.map);
                
                appState.userMarker.bindPopup('📍 You are here');
                appState.map.setView([latitude, longitude], 12);
                
                console.log('Location found:', { latitude, longitude });
            },
            (error) => {
                console.warn('Geolocation error:', error.message);
                alert('Unable to get location. Using default location.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

function createEventMarker() {
    const beachName = prompt('Enter beach name:');
    if (!beachName) return;
    
    const eventDate = prompt('Enter event date (YYYY-MM-DD):');
    if (!eventDate) return;
    
    const mapCenter = appState.map.getCenter();
    
    const newEvent = {
        id: `event-${Date.now()}`,
        name: beachName,
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        date: eventDate,
        participants: 1,
        creator: 'You',
    };
    
    appState.events.push(newEvent);
    addBeachMarker(newEvent.lat, newEvent.lng, newEvent.name, newEvent);
    renderEvents();
    
    alert(`✨ Event created: ${beachName}`);
}

// ============================================
// WEATHER FUNCTIONALITY
// ============================================

async function loadWeather() {
    const weatherInfo = document.getElementById('weatherInfo');
    const forecastInfo = document.getElementById('forecastInfo');
    const waterInfo = document.getElementById('waterInfo');
    
    try {
        // Fetch 4-day forecast from NEA API (with CORS handling)
        const response = await fetch('https://api.data.gov.sg/v1/environment/4-day-weather-forecast');
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const forecasts = data.items[0].forecasts || [];
            
            // Get current conditions from first forecast
            const currentForecast = forecasts[0];
            const currentTemp = Math.round((currentForecast.temperature.high + currentForecast.temperature.low) / 2);
            
            // Render current weather
            weatherInfo.innerHTML = `
                <div style="display: grid; gap: 8px;">
                    <p><strong>${currentTemp}°C</strong> - Current Temperature</p>
                    <p>📍 Singapore</p>
                    <p style="font-size: 0.9rem; color: #2C3E50;">
                        ${currentForecast.forecast}
                    </p>
                    <p style="color: #2ecc71; font-weight: 500; margin-top: 8px;">✓ Live NEA Data</p>
                </div>
            `;
            
            // Render 4-day forecast
            const forecastHtml = forecasts.slice(0, 4).map((f, index) => {
                const date = new Date(f.date);
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const dayName = days[date.getDay()];
                const dateStr = date.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
                
                return `
                    <div style="padding: 12px; border-bottom: 1px solid #eee; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <strong>${dayName}</strong> ${dateStr}
                            <p style="font-size: 0.85rem; color: #2C3E50; margin-top: 4px;">
                                ${f.forecast}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 4px;">
                                💨 ${f.wind.speed.low}-${f.wind.speed.high} km/h
                            </div>
                            <div style="font-weight: 600; color: #0077BE;">
                                ${f.temperature.high}°C - ${f.temperature.low}°C
                            </div>
                            <div style="font-size: 0.8rem; color: #7f8c8d;">
                                💧 ${f.relative_humidity.low}-${f.relative_humidity.high}%
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            forecastInfo.innerHTML = forecastHtml;
            
            // Water conditions (estimated based on forecast)
            const avgTemp = Math.round((currentForecast.temperature.high + currentForecast.temperature.low) / 2);
            waterInfo.innerHTML = `
                <div style="display: grid; gap: 8px;">
                    <p><strong>${avgTemp - 2}°C</strong> Water Temperature</p>
                    <p>🌊 Wave Height: ${currentForecast.wind.speed.low > 10 ? '1.0-1.5m' : '0.5-1.0m'}</p>
                    <p>💨 Wind: ${currentForecast.wind.direction} ${currentForecast.wind.speed.low}-${currentForecast.wind.speed.high} km/h</p>
                    <p>👁️ Visibility: Good</p>
                    <p style="color: #2ecc71; font-weight: 500; margin-top: 8px;">✓ Good for cleanup!</p>
                </div>
            `;
            
            return;
        }
        
        throw new Error('No forecast data available');
        
    } catch (error) {
        console.error('Weather loading error:', error);
        loadWeatherFallback(weatherInfo, forecastInfo, waterInfo);
    }
}

function loadWeatherFallback(weatherInfo, forecastInfo, waterInfo) {
    // Enhanced fallback with realistic demo data for Singapore
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const forecast = [];
    const forecastConditions = ['☀️ Sunny', '⛅ Partly Cloudy', '☁️ Cloudy', '🌧️ Rainy'];
    
    for (let i = 0; i < 4; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        forecast.push({
            day: days[date.getDay()],
            date: date.toLocaleDateString('en-SG'),
            condition: forecastConditions[i % 4],
            high: 24 - i,
            low: 18 + i,
        });
    }
    
    const currentTemp = 22;
    
    // Render current weather
    weatherInfo.innerHTML = `
        <div style="display: grid; gap: 8px;">
            <p><strong>${currentTemp}°C</strong> - Current Temperature</p>
            <p>📍 Singapore</p>
            <p style="color: #7f8c8d; font-size: 0.9rem;">⚠️ Using demo data (API unavailable)</p>
            <p style="color: #f39c12; font-weight: 500; margin-top: 8px;">Typical conditions for Singapore</p>
        </div>
    `;
    
    // Render 4-day forecast
    forecastInfo.innerHTML = forecast.map(day => `
        <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${day.day}</strong> ${day.date}
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.95rem; color: #2C3E50; margin-bottom: 4px;">
                    ${day.condition}
                </div>
                <div style="font-size: 0.85rem; color: #7f8c8d;">
                    ${day.high}°C - ${day.low}°C
                </div>
            </div>
        </div>
    `).join('');
    
    // Render water conditions
    waterInfo.innerHTML = `
        <div style="display: grid; gap: 8px;">
            <p><strong>20°C</strong> Water Temperature</p>
            <p>🌊 Wave Height: 0.5 - 1.0 m</p>
            <p>👁️ Visibility: Good</p>
            <p>💧 Current: Moderate</p>
            <p style="color: #2ecc71; font-weight: 500; margin-top: 8px;">✓ Good for cleanup!</p>
        </div>
    `;
}

// ============================================
// CREW MANAGEMENT
// ============================================

function loadMockData() {
    // Sample crew data
    appState.crews = [
        { id: 1, name: 'Alex', avatar: '👨‍🦱', cleanups: 12, itemsCollected: 450 },
        { id: 2, name: 'Jordan', avatar: '👩‍🦰', cleanups: 8, itemsCollected: 320 },
        { id: 3, name: 'Morgan', avatar: '🧑‍🦳', cleanups: 15, itemsCollected: 620 },
        { id: 4, name: 'Casey', avatar: '👩‍🦱', cleanups: 10, itemsCollected: 380 },
        { id: 5, name: 'Riley', avatar: '👨‍🦲', cleanups: 7, itemsCollected: 290 },
    ];
    
    // Sample events data
    appState.events = [
        {
            id: 'event-1',
            name: 'Manhattan Beach Cleanup',
            lat: 40.5731,
            lng: -73.9712,
            date: '2025-12-10',
            time: '10:00 AM',
            participants: 24,
            description: 'Help us clean Manhattan Beach!',
        },
        {
            id: 'event-2',
            name: 'Coney Island Coastal Cleanup',
            lat: 40.5731,
            lng: -73.9808,
            date: '2025-12-15',
            time: '2:00 PM',
            participants: 18,
            description: 'Join our Coney Island cleanup drive',
        },
        {
            id: 'event-3',
            name: 'Rockaway Beach Restoration',
            lat: 40.5755,
            lng: -73.8185,
            date: '2025-12-20',
            time: '9:00 AM',
            participants: 31,
            description: 'Restore Rockaway Beach community event',
        },
    ];
}

function renderCrew() {
    const crewList = document.getElementById('crewList');
    const totalCrew = document.getElementById('totalCrew');
    const cleanupCount = document.getElementById('cleanupCount');
    const itemsCollected = document.getElementById('itemsCollected');
    
    // Render crew members
    crewList.innerHTML = appState.crews.map(member => `
        <li class="crew-member" role="listitem">
            <div class="crew-avatar">${member.avatar}</div>
            <div class="crew-name">${member.name}</div>
            <div style="font-size: 0.8rem; color: #7f8c8d;">
                ${member.cleanups} cleanups
            </div>
        </li>
    `).join('');
    
    // Update stats
    totalCrew.textContent = appState.crews.length;
    cleanupCount.textContent = appState.crews.reduce((sum, c) => sum + c.cleanups, 0);
    itemsCollected.textContent = appState.crews.reduce((sum, c) => sum + c.itemsCollected, 0);
}

// ============================================
// EVENTS MANAGEMENT
// ============================================

function renderEvents() {
    const eventsList = document.getElementById('eventsList');
    
    eventsList.innerHTML = appState.events.map(event => `
        <li class="event-card" role="listitem">
            <div class="event-date">${event.date}</div>
            <h3 class="event-title">${event.name}</h3>
            <p class="event-location">📍 Beach Location</p>
            <p class="event-participants">👥 ${event.participants} people interested</p>
            <p style="color: #7f8c8d; font-size: 0.9rem; margin-top: 8px;">
                ⏰ ${event.time}
            </p>
            <p style="color: #2C3E50; margin: 8px 0;">
                ${event.description}
            </p>
            <button class="event-btn" onclick="joinEvent('${event.id}')" aria-label="Join event">
                ✨ Join Event
            </button>
        </li>
    `).join('');
    
    // Add markers to map for all events
    appState.markers.forEach(marker => appState.map.removeLayer(marker));
    appState.markers = [];
    
    appState.events.forEach(event => {
        addBeachMarker(event.lat, event.lng, event.name, event);
    });
}

function joinEvent(eventId) {
    const event = appState.events.find(e => e.id === eventId);
    if (event) {
        event.participants += 1;
        renderEvents();
        alert(`✨ Great! You joined "${event.name}"!\n👥 Total participants: ${event.participants}`);
    }
}

function joinNextCleanup() {
    appState.nextCleanupParticipants += 1;
    document.getElementById('nextCleanupParticipants').textContent = appState.nextCleanupParticipants;
    alert(`✨ You're in! You've joined the Pasir Ris cleanup!\n👥 Total participants: ${appState.nextCleanupParticipants}`);
    announceToScreenReader(`You have joined the Pasir Ris cleanup. Total participants: ${appState.nextCleanupParticipants}`);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Navigation buttons
    const getStartedBtn = document.getElementById('getStartedBtn');
    const learnMoreBtn = document.getElementById('learnMoreBtn');
    const ctaBtn = document.getElementById('ctaBtn');
    const locateBtn = document.getElementById('locateBtn');
    const createEventBtn = document.getElementById('createEventBtn');
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    if (learnMoreBtn) {
        learnMoreBtn.addEventListener('click', () => {
            document.getElementById('crew-section').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            alert('🎉 Welcome to ShoreSquad! Explore the map, check weather, and join cleanup events.');
        });
    }
    
    if (locateBtn) {
        locateBtn.addEventListener('click', userLocation);
    }
    
    if (createEventBtn) {
        createEventBtn.addEventListener('click', createEventMarker);
    }
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// ============================================
// ACCESSIBILITY & PERFORMANCE
// ============================================

// Announce updates to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 1000);
}

// Lazy load images and content
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('loaded');
                }
            });
        });
        
        document.querySelectorAll('[data-lazy]').forEach(el => {
            observer.observe(el);
        });
    }
}

// Performance monitoring
function logPerformanceMetrics() {
    if (window.performance && performance.timing) {
        const pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`📊 Page Load Time: ${pageLoadTime}ms`);
    }
}

window.addEventListener('load', () => {
    setupLazyLoading();
    logPerformanceMetrics();
});

// Service Worker for offline support (production)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
        console.log('Service Worker not available in demo mode');
    });
}

console.log('ShoreSquad JavaScript loaded successfully 🌊');
