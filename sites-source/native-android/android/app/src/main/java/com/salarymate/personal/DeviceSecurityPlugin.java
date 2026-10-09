package com.salarymate.personal;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSecurity")
public class DeviceSecurityPlugin extends Plugin {
    private static final String PREFS = "salarymate_security";
    private static final String LOCK_ENABLED = "app_lock_enabled";
    private static final String SCREEN_PROTECTION_ENABLED = "screen_protection_enabled";
    private static final String LAST_UNLOCK_ELAPSED = "last_unlock_elapsed";
    private static final long UNLOCK_GRACE_MS = 45_000L;

    private SharedPreferences preferences;
    private PluginCall pendingCall;
    private Boolean pendingLockValue;

    @Override
    public void load() {
        preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private int allowedAuthenticators() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_WEAK
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    private boolean canAuthenticate() {
        return BiometricManager.from(getContext()).canAuthenticate(allowedAuthenticators())
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private JSObject currentStatus() {
        JSObject result = new JSObject();
        result.put("available", canAuthenticate());
        result.put("lockEnabled", preferences.getBoolean(LOCK_ENABLED, false));
        result.put("screenProtectionEnabled", preferences.getBoolean(SCREEN_PROTECTION_ENABLED, true));
        long lastUnlock = preferences.getLong(LAST_UNLOCK_ELAPSED, 0L);
        long unlockAge = SystemClock.elapsedRealtime() - lastUnlock;
        result.put("unlockedRecently", lastUnlock > 0L
            && unlockAge >= 0L && unlockAge <= UNLOCK_GRACE_MS);
        result.put("authenticator", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? "strong-biometric-or-device-credential"
            : "biometric-or-device-credential");
        return result;
    }

    @PluginMethod
    public void getValidationMode(PluginCall call) {
        boolean debug = (getContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        JSObject result = new JSObject();
        result.put("enabled", debug && getContext().getPackageName().equals("com.salarymate.personal.debug")
            && getActivity().getIntent().getBooleanExtra("salarymate_native_qa", false));
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(currentStatus());
    }

    @PluginMethod
    public void setScreenProtectionEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        preferences.edit().putBoolean(SCREEN_PROTECTION_ENABLED, enabled).apply();
        call.resolve(currentStatus());
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        beginAuthentication(call, null);
    }

    @PluginMethod
    public void configureLock(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        boolean current = preferences.getBoolean(LOCK_ENABLED, false);
        if (enabled == current) {
            call.resolve(currentStatus());
            return;
        }
        beginAuthentication(call, enabled);
    }

    private void beginAuthentication(PluginCall call, Boolean lockValue) {
        getActivity().runOnUiThread(() -> {
            if (pendingCall != null) {
                call.reject("另一個裝置驗證正在進行", "AUTH_BUSY");
                return;
            }
            if (!canAuthenticate()) {
                call.reject("此裝置尚未設定可用的螢幕鎖或生物辨識", "AUTH_UNAVAILABLE");
                return;
            }
            if (!(getActivity() instanceof FragmentActivity)) {
                call.reject("目前畫面不支援裝置驗證", "AUTH_UNAVAILABLE");
                return;
            }
            pendingCall = call;
            pendingLockValue = lockValue;
            String reason = call.getString("reason", lockValue == null
                ? "確認身分後開啟薪資資料"
                : "確認身分後變更 App 鎖定設定");
            BiometricPrompt prompt = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        PluginCall resolvedCall = pendingCall;
                        Boolean requestedLock = pendingLockValue;
                        pendingCall = null;
                        pendingLockValue = null;
                        preferences.edit().putLong(LAST_UNLOCK_ELAPSED, SystemClock.elapsedRealtime()).apply();
                        if (requestedLock != null) {
                            preferences.edit().putBoolean(LOCK_ENABLED, requestedLock).apply();
                        }
                        if (resolvedCall != null) resolvedCall.resolve(currentStatus());
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errorMessage) {
                        super.onAuthenticationError(errorCode, errorMessage);
                        PluginCall rejectedCall = pendingCall;
                        pendingCall = null;
                        pendingLockValue = null;
                        if (rejectedCall == null) return;
                        boolean cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED
                            || errorCode == BiometricPrompt.ERROR_CANCELED
                            || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON;
                        rejectedCall.reject(
                            cancelled ? "使用者取消裝置驗證" : errorMessage.toString(),
                            cancelled ? "AUTH_CANCELLED" : "AUTH_ERROR"
                        );
                    }
                }
            );
            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("解鎖個人薪資管理")
                .setSubtitle(reason)
                .setAllowedAuthenticators(allowedAuthenticators())
                .build();
            prompt.authenticate(promptInfo);
        });
    }
}
