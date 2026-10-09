package com.salarymate.personal;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SalaryMateInstrumentedTest {

    @Test
    public void appUsesExpectedApplicationId() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String applicationId = appContext.getPackageName();
        assertTrue(
            applicationId.equals("com.salarymate.personal")
                || applicationId.equals("com.salarymate.personal.debug")
        );
    }

    @Test
    public void formalIdentityMatchesCandidate() throws PackageManager.NameNotFoundException {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PackageInfo packageInfo = appContext.getPackageManager().getPackageInfo(appContext.getPackageName(), 0);

        assertEquals(21L, packageInfo.getLongVersionCode());
        assertNotNull(packageInfo.versionName);
        assertTrue(packageInfo.versionName.equals("4.3.2") || packageInfo.versionName.equals("4.3.2-debug"));
    }

    @Test
    public void fileProviderMatchesRuntimePackageAndIsPrivate() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String authority = appContext.getPackageName() + ".fileprovider";
        ProviderInfo provider = appContext.getPackageManager().resolveContentProvider(authority, 0);

        assertNotNull(provider);
        assertFalse(provider.exported);
        assertTrue(provider.grantUriPermissions);
    }

    @Test
    public void backupAndDatabaseIdentityRemainStable() throws PackageManager.NameNotFoundException {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ApplicationInfo applicationInfo = appContext.getPackageManager().getApplicationInfo(appContext.getPackageName(), 0);

        assertEquals(0, applicationInfo.flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertEquals("salarymateSQLite.db", appContext.getDatabasePath("salarymateSQLite.db").getName());
    }
}
