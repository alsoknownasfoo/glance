import { setupContentInContainer } from './page.js';

const CACHE_PREFIX = 'glance-widget-';
const CACHE_VERSION = 1;

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
        setTimeout(() => spinner.remove(), 300);
    }
}

async function fetchWidgetContent(widgetId, baseURL) {
    const response = await fetch(`${baseURL}/api/widgets/${widgetId}/content/`);
    if (!response.ok) {
        throw new Error(`Failed to fetch widget: ${response.statusText}`);
    }
    return await response.text();
}

function animateContentUpdate(widgetElement, newContentHTML) {
    return new Promise((resolve) => {
        const contentContainer = widgetElement.querySelector('.widget-content');
        if (!contentContainer) {
            resolve();
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
            }, 300);
        }, 300);
    });
}

async function updateProgressiveWidget(widgetElement, baseURL) {
    const widgetId = widgetElement.dataset.widgetId;
    if (!widgetId) return;

    const spinner = addLoadingIndicator(widgetElement);

    try {
        const freshHTML = await fetchWidgetContent(widgetId, baseURL);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(freshHTML, 'text/html');
        const newContent = doc.querySelector('.widget-content');
        
        if (newContent) {
            await animateContentUpdate(widgetElement, newContent.innerHTML);
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

export async function setupProgressiveCache(baseURL) {
    const pageElement = document.getElementById('page');
    if (!pageElement || !pageElement.classList.contains('progressive-loading')) {
        return false;
    }

    const widgets = document.querySelectorAll('[data-widget-id]');
    if (widgets.length === 0) {
        return false;
    }

    let hadAnyCachedContent = false;

    for (const widgetElement of widgets) {
        const hadCache = await loadCachedContent(widgetElement);
        if (hadCache) {
            hadAnyCachedContent = true;
        }
    }
    
    widgets.forEach(widgetElement => {
        updateProgressiveWidget(widgetElement, baseURL);
    });

    return hadAnyCachedContent;
}

export function clearProgressiveCache() {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Failed to clear progressive cache:', e);
    }
}
