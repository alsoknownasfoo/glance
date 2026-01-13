import { setupContentInContainer } from './page.js';

const CACHE_PREFIX = 'glance-widget-';
const CACHE_VERSION = 1;
const ANIMATION_DURATION = 300;
const FAST_UPDATE_THRESHOLD = 60;

let autoRefreshTimers = new Map();
let isPageVisible = true;

function getCacheKey(widgetId) {
    return `${CACHE_PREFIX}${widgetId}-v${CACHE_VERSION}`;
}

function saveWidgetToCache(widgetId, html) {
    try {
        localStorage.setItem(getCacheKey(widgetId), html);
    } catch (e) {
        console.warn('Failed to cache widget content:', e);
    }
}

function loadWidgetFromCache(widgetId) {
    try {
        return localStorage.getItem(getCacheKey(widgetId));
    } catch (e) {
        console.warn('Failed to load widget from cache:', e);
        return null;
    }
}

function createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'progressive-cache-spinner';
    spinner.innerHTML = `
        <svg class="spinner-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle class="spinner-circle" cx="12" cy="12" r="10" fill="none" stroke-width="3"/>
        </svg>
    `;
    return spinner;
}

function addLoadingIndicator(widgetElement) {
    const header = widgetElement.querySelector('.widget-header');
    if (!header) return null;
    
    const spinner = createLoadingSpinner();
    header.appendChild(spinner);
    return spinner;
}

function removeLoadingIndicator(spinner) {
    if (spinner) {
        spinner.classList.add('fade-out');
        setTimeout(() => spinner.remove(), ANIMATION_DURATION);
    }
}

async function fetchWidgetContent(widgetId, baseURL) {
    const response = await fetch(`${baseURL}/api/widgets/${widgetId}/content/`);
    if (!response.ok) {
        throw new Error(`Failed to fetch widget: ${response.statusText}`);
    }
    return await response.text();
}

function animateContentUpdate(widgetElement, newContentHTML, skipAnimation) {
    return new Promise((resolve) => {
        const contentContainer = widgetElement.querySelector('.widget-content');
        if (!contentContainer) {
            resolve();
            return;
        }

        if (skipAnimation) {
            contentContainer.innerHTML = newContentHTML;
            setupContentInContainer(contentContainer).then(resolve);
            return;
        }

        contentContainer.classList.add('progressive-cache-fade-out');

        setTimeout(async () => {
            contentContainer.innerHTML = newContentHTML;
            await setupContentInContainer(contentContainer);

            contentContainer.classList.remove('progressive-cache-fade-out');
            contentContainer.classList.add('progressive-cache-fade-in');

            setTimeout(() => {
                contentContainer.classList.remove('progressive-cache-fade-in');
                resolve();
            }, ANIMATION_DURATION);
        }, ANIMATION_DURATION);
    });
}

async function updateProgressiveWidget(widgetElement, baseURL) {
    const widgetId = widgetElement.dataset.widgetId;
    if (!widgetId) return;

    const cacheDuration = parseInt(widgetElement.dataset.cacheDuration, 10);
    const skipAnimation = cacheDuration > 0 && cacheDuration <= FAST_UPDATE_THRESHOLD;
    const spinner = skipAnimation ? null : addLoadingIndicator(widgetElement);

    try {
        const freshHTML = await fetchWidgetContent(widgetId, baseURL);
        const parser = new DOMParser();
        const doc = parser.parseFromString(freshHTML, 'text/html');
        const newContent = doc.querySelector('.widget-content');
        
        if (newContent) {
            await animateContentUpdate(widgetElement, newContent.innerHTML, skipAnimation);
            saveWidgetToCache(widgetId, freshHTML);
        }
    } catch (error) {
        console.error('Failed to update progressive widget:', error);
    } finally {
        removeLoadingIndicator(spinner);
    }
}

async function loadCachedContent(widgetElement) {
    const widgetId = widgetElement.dataset.widgetId;
    if (!widgetId) return false;

    const cachedHTML = loadWidgetFromCache(widgetId);
    if (!cachedHTML) return false;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(cachedHTML, 'text/html');
        const cachedContent = doc.querySelector('.widget-content');
        
        if (cachedContent) {
            const currentContent = widgetElement.querySelector('.widget-content');
            if (currentContent) {
                currentContent.innerHTML = cachedContent.innerHTML;
                await setupContentInContainer(currentContent);
                widgetElement.classList.add('progressive-cache-loaded');
                return true;
            }
        }
    } catch (error) {
        console.warn('Failed to load cached content:', error);
    }

    return false;
}

function handleVisibilityChange() {
    isPageVisible = !document.hidden;
    
    if (isPageVisible) {
        autoRefreshTimers.forEach((timer, widgetId) => {
            if (timer.shouldRefresh) {
                const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
                if (widgetElement) {
                    updateProgressiveWidget(widgetElement, timer.baseURL);
                    timer.shouldRefresh = false;
                }
            }
        });
    }
}

function scheduleAutoRefresh(widgetElement, baseURL) {
    const widgetId = widgetElement.dataset.widgetId;
    const cacheDuration = parseInt(widgetElement.dataset.cacheDuration, 10);

    if (!cacheDuration || cacheDuration <= 0) return;

    const existingTimer = autoRefreshTimers.get(widgetId);
    if (existingTimer?.timerId) {
        clearTimeout(existingTimer.timerId);
    }

    const refreshInterval = cacheDuration * 1000;

    const scheduleNext = () => {
        const timerId = setTimeout(() => {
            if (isPageVisible) {
                updateProgressiveWidget(widgetElement, baseURL).then(scheduleNext);
            } else {
                const timer = autoRefreshTimers.get(widgetId);
                if (timer) timer.shouldRefresh = true;
                scheduleNext();
            }
        }, refreshInterval);

        autoRefreshTimers.set(widgetId, {
            timerId,
            baseURL,
            shouldRefresh: false
        });
    };

    scheduleNext();
}

export async function setupProgressiveCache(baseURL) {
    const pageElement = document.getElementById('page');
    if (!pageElement?.classList.contains('progressive-loading')) return false;

    const widgets = document.querySelectorAll('[data-widget-id]');
    if (widgets.length === 0) return false;

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let hadAnyCachedContent = false;

    for (const widgetElement of widgets) {
        if (await loadCachedContent(widgetElement)) {
            hadAnyCachedContent = true;
        }
    }
    
    widgets.forEach(widgetElement => {
        updateProgressiveWidget(widgetElement, baseURL);
        scheduleAutoRefresh(widgetElement, baseURL);
    });

    return hadAnyCachedContent;
}

export function clearProgressiveCache() {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Failed to clear progressive cache:', e);
    }
}
