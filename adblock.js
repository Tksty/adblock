(function() {
    var hostsUrl = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";
    var blockedHosts = [];
    var discoveredHosts = [];

    function isBlocked(url) {
        return blockedHosts.some(function(host) {
            return url.includes(host);
        });
    }

    function getHost(url) {
        try {
            var parser = new URL(url);
            return parser.hostname;
        } catch (e) {
            return '';
        }
    }

    function fetchHostsList() {
        fetch(hostsUrl)
            .then(function(response) { return response.text(); })
            .then(function(text) {
                parseHosts(text);
                console.log('[AdBlock] Loaded', blockedHosts.length, 'hosts');
            })
            .catch(function(err) {
                console.error('[AdBlock] Failed to load hosts list:', err);
            });
    }

    function parseHosts(text) {
        var lines = text.split('\n');
        lines.forEach(function(line) {
            line = line.trim();
            if (line.startsWith("#") || line === "") return;
            if (line.startsWith("0.0.0.0") || line.startsWith("127.0.0.1")) {
                var parts = line.split(/\s+/);
                if (parts.length >= 2) {
                    var host = parts[1].trim();
                    if (host && !blockedHosts.includes(host)) {
                        blockedHosts.push(host);
                    }
                }
            }
        });
    }

    function patchFetch() {
        var originalFetch = window.fetch;
        window.fetch = function() {
            var url = arguments[0];
            if (typeof url === 'string') {
                var host = getHost(url);
                if (host && !discoveredHosts.includes(host)) {
                    console.log('[AdBlock] Discovered fetch host:', host);
                    discoveredHosts.push(host);
                }
                if (isBlocked(url)) {
                    console.log('[AdBlock] Blocked fetch to', url);
                    return new Promise(function(){}); // prevent request
                }
            }
            return originalFetch.apply(this, arguments);
        };
    }

    function patchXHR() {
        var originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string') {
                var host = getHost(url);
                if (host && !discoveredHosts.includes(host)) {
                    console.log('[AdBlock] Discovered XHR host:', host);
                    discoveredHosts.push(host);
                }
                if (isBlocked(url)) {
                    console.log('[AdBlock] Blocked XHR to', url);
                    return; // do nothing
                }
            }
            return originalOpen.apply(this, arguments);
        };
    }

    function patchDOM() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'SCRIPT' || node.tagName === 'IMG' || node.tagName === 'IFRAME') {
                        var src = node.src || '';
                        if (src) {
                            var host = getHost(src);
                            if (host && !discoveredHosts.includes(host)) {
                                console.log('[AdBlock] Discovered DOM host:', host);
                                discoveredHosts.push(host);
                            }
                            if (isBlocked(src)) {
                                console.log('[AdBlock] Removed', src);
                                node.remove();
                            }
                        }
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Start everything
    fetchHostsList();
    patchFetch();
    patchXHR();
    patchDOM();

    // Optional: expose for debugging
    window.getBlockedHosts = function() { return blockedHosts; };
    window.getDiscoveredHosts = function() { return discoveredHosts; };
})();
