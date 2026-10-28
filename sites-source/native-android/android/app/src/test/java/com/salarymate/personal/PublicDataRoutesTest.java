package com.salarymate.personal;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PublicDataRoutesTest {
    @Test public void marketQueriesAndPreflightUseTheExactPublicRoutes() {
        for (String route : new String[]{"quotes", "nav", "lookup", "dividends", "catalog", "sessions", "history"}) {
            String path = "/api/stocks/portable/" + route;
            assertTrue(path, PublicDataRoutes.allows(path, "POST", false));
            assertTrue(path, PublicDataRoutes.allows(path, "OPTIONS", false));
            for (String method : new String[]{"GET", "PUT", "DELETE", "PATCH", "HEAD", "post"}) {
                assertFalse(path + " " + method, PublicDataRoutes.allows(path, method, false));
            }
            assertFalse(path, PublicDataRoutes.allows(path, "POST", true));
        }
    }

    @Test public void referenceExchangeRatesAreReadOnly() {
        assertTrue(PublicDataRoutes.allows("/api/reference/fx", "GET", false));
        assertTrue(PublicDataRoutes.allows("/api/reference/fx", "OPTIONS", false));
        assertFalse(PublicDataRoutes.allows("/api/reference/fx", "POST", false));
        assertFalse(PublicDataRoutes.allows("/api/reference/fx", "GET", true));
    }

    @Test public void otherApiAndAmbiguousEncodedPathsRemainBlocked() {
        for (String path : new String[]{null, "/api/backup", "/api/stocks/history", "/api/stocks/portable/history/",
                "/api/stocks/portable/history/../backup", "/api/stocks/portable/%68istory", "/api/reference/fx/", "/index.html"}) {
            for (String method : new String[]{null, "GET", "POST", "OPTIONS"}) {
                assertFalse(String.valueOf(path), PublicDataRoutes.allows(path, method, false));
            }
        }
    }
}
