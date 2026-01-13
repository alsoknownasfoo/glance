# Progressive Cache

Progressive cache is a client-side caching feature that improves the user experience when loading Glance pages, especially when used as a new tab homepage.

## How It Works

Progressive caching stores widget content in the browser's localStorage and displays it immediately on page load, while fetching fresh data in the background according to each widget's cache settings. When new data arrives, it smoothly fades in.

**Benefits:**
- **Instant page loads** - Cached content displays immediately
- **No loading spinner** - Page appears instantly (when using `progressive-loading: true`)
- **Smooth updates** - Fresh content fades in seamlessly
- **Persistent across sessions** - Cache survives browser restarts
- **Respects server cache** - Widget cache durations control server-side fetch frequency

## Configuration

Enable progressive loading at the page level to enable client-side caching for all widgets:

### Page-Level Progressive Loading

Add `progressive-loading: true` to your page configuration:

```yaml
pages:
  - name: Home
    progressive-loading: true  # Enables client-side cache for ALL widgets
    columns:
      - size: full
        widgets:
          - type: hacker-news
            cache: 1h          # Server fetches fresh data every hour
          
          - type: rss
            cache: 12h         # Server fetches every 12 hours
            feeds:
              - url: https://example.com/feed.xml
          
          - type: weather
            cache: none        # Server always fetches fresh data
            location: London, UK
```

**How it works:**
- `progressive-loading: true` enables **browser-side** instant loading for all widgets
- Individual `cache:` settings control **server-side** fetch frequency
- Browser displays cached content instantly while server checks if new data is needed
- Perfect separation of concerns: UI responsiveness vs. data freshness

## Widget Cache Settings

Individual widget cache settings control how often the **server** fetches fresh data:

- `cache: none` - Always fetch fresh data from source (no server-side caching)
- `cache: 5m` - Cache for 5 minutes
- `cache: 1h` - Cache for 1 hour  
- `cache: 12h` - Cache for 12 hours
- `cache: 1d` - Cache for 1 day
- *(omit cache key)* - Uses widget's default cache duration

**Note:** These cache settings are independent of `progressive-loading`. The page loads instantly with cached content, and the server respects these durations when deciding whether to fetch new data.

## Example Configuration

Complete example using page-level progressive loading:

```yaml
pages:
  - name: Dashboard
    progressive-loading: true  # All widgets use client-side cache
    columns:
      - size: small
        widgets:
          - type: calendar
            first-day-of-week: monday

          - type: weather
            location: New York, USA
            units: imperial
            cache: 30m  # Server updates every 30 minutes

      - size: full
        widgets:
          - type: hacker-news
            limit: 20
            cache: 5m  # Fresh HN stories every 5 minutes

          - type: rss
            limit: 15
            collapse-after: 5
            cache: 12h  # RSS updates twice daily
            feeds:
              - url: https://news.ycombinator.com/rss
              - url: https://lobste.rs/rss

      - size: small
        widgets:
          - type: markets
            cache: none  # Always fetch latest prices
            markets:
              - symbol: SPY
                name: S&P 500
              - symbol: BTC-USD
                name: Bitcoin
```

With this configuration:
- ✅ Page shows **instantly** on load (no spinner)
- ✅ All widgets display cached content immediately
- ✅ Server respects individual cache durations (5m, 30m, 12h, none)
- ✅ Fresh data loads in background with smooth animations
- ✅ Perfect for browser new tab page

## Animations

The progressive cache feature includes subtle animations:
- **Fade out** - Old content fades to 30% opacity (300ms)
- **Fade in** - New content fades from 30% to 100% opacity (300ms)
- **Spinner** - A small animated spinner appears in the widget header while loading
- **Smooth transitions** - All animations use CSS for optimal performance

## Clearing Cache

The cache is automatically managed by Glance. If you need to clear it manually, you can:
1. Clear your browser's localStorage
2. Use browser developer tools to inspect and remove cached items
3. Cached items are prefixed with `glance-widget-` for easy identification

## Compatibility

Progressive cache works with:
- All modern browsers that support localStorage
- All widget types
- Respects all cache durations (none, 5m, 1h, 12h, 1d, etc.)
