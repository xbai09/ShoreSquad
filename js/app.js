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
    weatherApiDemo: true, // Demo mode for weather data
    defaultLocation: { lat: 40.7128, lng: -74.0060 }, // NYC
};

let appState = {
    map: null,
    userLocation: null,
    crews: [],
    events: [],
    markers: [],
    userMarker: null,
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('ShoreSquad App Initializing...');
    
    initializeMap();
    loadMockData();
    setupEventListeners();
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
        // Demo weather data (replace with real API calls in production)
        const currentWeather = {
            temp: 72,
            condition: 'Partly Cloudy',
            humidity: 65,
            windSpeed: 12,
            windDirection: 'NE',
        };
        
        const forecast = [
            { day: 'Mon', high: 75, low: 65, condition: '☀️ Sunny' },
            { day: 'Tue', high: 73, low: 63, condition: '☁️ Cloudy' },
            { day: 'Wed', high: 68, low: 60, condition: '🌧️ Rainy' },
            { day: 'Thu', high: 71, low: 62, condition: '☀️ Sunny' },
            { day: 'Fri', high: 76, low: 66, condition: '☀️ Sunny' },
        ];
        
        const waterConditions = {
            temp: 68,
            waveHeight: 2.5,
            visibility: 'Good',
            current: 'Moderate',
        };
        
        // Render current weather
        weatherInfo.innerHTML = `
            <div style="display: grid; gap: 8px;">
                <p><strong>${currentWeather.temp}°F</strong> - ${currentWeather.condition}</p>
                <p>💧 Humidity: ${currentWeather.humidity}%</p>
                <p>💨 Wind: ${currentWeather.windSpeed} mph ${currentWeather.windDirection}</p>
            </div>
        `;
        
        // Render forecast
        forecastInfo.innerHTML = forecast.map(day => `
            <div style="padding: 8px; border-bottom: 1px solid #eee;">
                <strong>${day.day}</strong>: ${day.condition} (${day.high}°F/${day.low}°F)
            </div>
        `).join('');
        
        // Render water conditions
        waterInfo.innerHTML = `
            <div style="display: grid; gap: 8px;">
                <p><strong>${waterConditions.temp}°F</strong> Water Temperature</p>
                <p>🌊 Wave Height: ${waterConditions.waveHeight} ft</p>
                <p>👁️ Visibility: ${waterConditions.visibility}</p>
                <p>💧 Current: ${waterConditions.current}</p>
                <p style="color: #2ecc71; font-weight: 500; margin-top: 8px;">✓ Good for cleanup!</p>
            </div>
        `;
    } catch (error) {
        console.error('Weather loading error:', error);
        weatherInfo.innerHTML = '<p style="color: #e74c3c;">Failed to load weather data</p>';
    }
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
