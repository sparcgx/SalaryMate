package com.salarymate.personal;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Public data requests from the app's own HTTPS origin only. */
final class PublicDataRoutes {
    private static final Set<String> MARKET_PATHS = new HashSet<>(Arrays.asList(
        "/api/stocks/portable/quotes", "/api/stocks/portable/nav", "/api/stocks/portable/lookup",
        "/api/stocks/portable/dividends", "/api/stocks/portable/catalog",
        "/api/stocks/portable/sessions", "/api/stocks/portable/history"
    ));

    private PublicDataRoutes() {}

    static boolean allows(String encodedPath, String method, boolean mainFrame) {
        if (mainFrame) return false;
        if (MARKET_PATHS.contains(encodedPath)) return "POST".equals(method) || "OPTIONS".equals(method);
        return "/api/reference/fx".equals(encodedPath) && ("GET".equals(method) || "OPTIONS".equals(method));
    }
}
