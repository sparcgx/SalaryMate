package com.salarymate.personal

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

data class NativeSecurityStatus(
    val available: Boolean = false,
    val lockEnabled: Boolean = false,
    val screenProtectionEnabled: Boolean = true,
    val unlockedRecently: Boolean = false
)

class NativeSecurityController(private val activity: FragmentActivity) {
    private val preferences = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private var authenticating = false

    fun isLockEnabled(): Boolean = preferences.getBoolean(LOCK_ENABLED, false)

    fun currentStatus(): NativeSecurityStatus {
        val lastUnlock = preferences.getLong(LAST_UNLOCK_ELAPSED, 0L)
        val unlockAge = SystemClock.elapsedRealtime() - lastUnlock
        return NativeSecurityStatus(
            available = canAuthenticate(),
            lockEnabled = isLockEnabled(),
            screenProtectionEnabled = preferences.getBoolean(SCREEN_PROTECTION_ENABLED, true),
            unlockedRecently = lastUnlock > 0L && unlockAge in 0..UNLOCK_GRACE_MS
        )
    }

    fun applyScreenProtection() {
        val enabled = preferences.getBoolean(SCREEN_PROTECTION_ENABLED, true)
        if (enabled) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    fun setScreenProtectionEnabled(enabled: Boolean): NativeSecurityStatus {
        preferences.edit().putBoolean(SCREEN_PROTECTION_ENABLED, enabled).apply()
        applyScreenProtection()
        return currentStatus()
    }

    fun configureLock(
        enabled: Boolean,
        onBusyChanged: (Boolean) -> Unit,
        onSucceeded: (NativeSecurityStatus) -> Unit,
        onFailed: (String) -> Unit
    ) {
        if (enabled == isLockEnabled()) {
            onSucceeded(currentStatus())
            return
        }
        authenticate(
            onBusyChanged = onBusyChanged,
            onSucceeded = {
                preferences.edit().putBoolean(LOCK_ENABLED, enabled).apply()
                onSucceeded(currentStatus())
            },
            onFailed = { message ->
                onFailed(
                    if (message.startsWith("驗證已取消")) "驗證已取消，App 鎖設定未變更。"
                    else message
                )
            },
            reason = "確認身分後${if (enabled) "啟用" else "停用"} App 鎖"
        )
    }

    fun authenticate(
        onBusyChanged: (Boolean) -> Unit,
        onSucceeded: () -> Unit,
        onFailed: (String) -> Unit,
        reason: String = "確認身分後開啟薪資與快速登記"
    ) {
        if (authenticating) return
        if (!canAuthenticate()) {
            onFailed("請先在 Android 設定啟用螢幕鎖或生物辨識，再返回重試。")
            return
        }
        authenticating = true
        onBusyChanged(true)
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    authenticating = false
                    preferences.edit().putLong(LAST_UNLOCK_ELAPSED, SystemClock.elapsedRealtime()).apply()
                    onBusyChanged(false)
                    onSucceeded()
                }

                override fun onAuthenticationError(errorCode: Int, errorMessage: CharSequence) {
                    super.onAuthenticationError(errorCode, errorMessage)
                    authenticating = false
                    onBusyChanged(false)
                    val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                    onFailed(
                        if (cancelled) "驗證已取消，薪資資料仍保持鎖定。"
                        else "無法完成裝置驗證：$errorMessage"
                    )
                }
            }
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("解鎖個人薪資管理")
                .setSubtitle(reason)
                .setAllowedAuthenticators(allowedAuthenticators())
                .build()
        )
    }

    private fun canAuthenticate(): Boolean =
        BiometricManager.from(activity).canAuthenticate(allowedAuthenticators()) ==
            BiometricManager.BIOMETRIC_SUCCESS

    private fun allowedAuthenticators(): Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    } else {
        BiometricManager.Authenticators.BIOMETRIC_WEAK or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    }

    companion object {
        const val PREFS = "salarymate_security"
        const val LOCK_ENABLED = "app_lock_enabled"
        const val SCREEN_PROTECTION_ENABLED = "screen_protection_enabled"
        const val LAST_UNLOCK_ELAPSED = "last_unlock_elapsed"
        const val UNLOCK_GRACE_MS = 45_000L
    }
}
