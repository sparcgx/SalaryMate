package com.salarymate.personal

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.fragment.app.FragmentActivity
import com.salarymate.personal.backup.NativeBackupCryptoException
import com.salarymate.personal.backup.NativeBackupService
import com.salarymate.personal.backup.NativeRestoreCandidate
import com.salarymate.personal.backup.PreparedNativeBackup
import com.salarymate.personal.data.NativeSalaryMateRepository
import com.salarymate.personal.data.NativeSaveResult
import com.salarymate.personal.ui.SalaryMateLockedScreen
import com.salarymate.personal.ui.SalaryMateShell
import com.salarymate.personal.ui.SalaryMateTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ComposeShellActivity : FragmentActivity() {
    private val activityJob = SupervisorJob()
    private val activityScope = CoroutineScope(activityJob + Dispatchers.Main.immediate)
    private val repository by lazy { NativeSalaryMateRepository(applicationContext) }
    private val backupService by lazy { NativeBackupService(applicationContext, repository) }
    private lateinit var security: NativeSecurityController
    private var unlocked by mutableStateOf(false)
    private var authenticationBusy by mutableStateOf(false)
    private var lockMessage by mutableStateOf("個人薪資管理已鎖定。")
    private var refreshSignal by mutableIntStateOf(0)
    private var securityStatus by mutableStateOf(NativeSecurityStatus())
    private var settingsBusy by mutableStateOf(false)
    private var settingsNotice by mutableStateOf<String?>(null)
    private var settingsNoticeSignal by mutableIntStateOf(0)
    private var openingWebCore = false
    private var externalSystemFlow = false
    private var pendingBackup: PreparedNativeBackup? = null
    private var pendingEncryptedImport: String? = null
    private var restorePickerActive = false
    private var restoreCandidate by mutableStateOf<NativeRestoreCandidate?>(null)

    private val createBackupDocument = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream")
    ) { uri ->
        externalSystemFlow = false
        val prepared = pendingBackup
        pendingBackup = null
        if (uri == null || prepared == null) {
            publishNotice("已取消建立外部備份，資料沒有變更。")
            return@registerForActivityResult
        }
        activityScope.launch {
            settingsBusy = true
            try {
                val savedName = backupService.writeDocumentAndVerify(uri, prepared.encryptedText)
                publishNotice("資料已匯出並完成寫入驗證：$savedName")
            } catch (error: Exception) {
                publishNotice(friendlyBackupError(error))
            } finally {
                settingsBusy = false
            }
        }
    }

    private val openBackupDocument = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        externalSystemFlow = false
        restorePickerActive = false
        if (uri == null) {
            publishNotice("已取消還原，現有資料沒有變更。")
            return@registerForActivityResult
        }
        activityScope.launch {
            settingsBusy = true
            try {
                val content = backupService.readDocument(uri)
                if (backupService.requiresPassword(content)) {
                    pendingEncryptedImport = content
                    publishNotice("此檔案已加密，請輸入原備份密碼。")
                } else {
                    restoreCandidate = backupService.prepareRestoreCandidate(content, "")
                    publishNotice("匯入檔案已驗證，請核對摘要後確認。")
                }
            } catch (error: Exception) {
                publishNotice(friendlyBackupError(error))
            } finally {
                settingsBusy = false
            }
        }
    }

    private val shareBackup = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        externalSystemFlow = false
        publishNotice("系統分享已關閉；請到接收位置確認備份檔案確實存在。")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        security = NativeSecurityController(this)
        security.applyScreenProtection()
        securityStatus = security.currentStatus()
        unlocked = !security.isLockEnabled()
        setContent {
            SalaryMateTheme {
                if (unlocked) {
                    SalaryMateShell(
                        repository = repository,
                        externalRefreshSignal = refreshSignal,
                        securityStatus = securityStatus,
                        settingsBusy = settingsBusy,
                        settingsNotice = settingsNotice,
                        settingsNoticeSignal = settingsNoticeSignal,
                        onSaveBackup = ::saveEncryptedBackup,
                        onShareBackup = ::shareEncryptedBackup,
                        onRestoreBackup = ::restoreEncryptedBackup,
                        encryptedImportPending = pendingEncryptedImport != null,
                        onUnlockImport = ::unlockImportedBackup,
                        onCancelImport = { pendingEncryptedImport = null },
                        restorePreview = restoreCandidate?.summary,
                        onConfirmRestore = ::confirmRestore,
                        onCancelRestore = ::cancelRestore,
                        onConfigureLock = ::configureLock,
                        onSetScreenProtection = ::setScreenProtection,
                        onLockNow = ::lockNow,
                        onOpenWeb = ::openWebCore
                    )
                } else {
                    SalaryMateLockedScreen(
                        message = lockMessage,
                        busy = authenticationBusy,
                        onUnlock = ::requestUnlock,
                        onLeave = { moveTaskToBack(true) }
                    )
                }
            }
        }
        if (!unlocked) window.decorView.post(::requestUnlock)
    }

    override fun onResume() {
        super.onResume()
        if (!::security.isInitialized) return
        security.applyScreenProtection()
        securityStatus = security.currentStatus()
        if (openingWebCore) {
            openingWebCore = false
            refreshSignal++
        } else if (!unlocked && security.isLockEnabled()) {
            window.decorView.post(::requestUnlock)
        }
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations && !openingWebCore && !externalSystemFlow &&
            ::security.isInitialized && security.isLockEnabled()
        ) {
            unlocked = false
            lockMessage = "個人薪資管理已鎖定。"
        }
    }

    override fun onDestroy() {
        activityJob.cancel()
        super.onDestroy()
    }

    private fun openWebCore(tab: String?, action: String?) {
        openingWebCore = true
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                putExtra(MainActivity.EXTRA_TAB, tab)
                putExtra(MainActivity.EXTRA_ACTION, action)
            }
        )
    }

    private fun saveEncryptedBackup(password: String) {
        if (!canStartSettingsOperation()) return
        activityScope.launch {
            settingsBusy = true
            try {
                pendingBackup = if (password.isBlank()) backupService.preparePlainBackup()
                    else backupService.prepareEncryptedBackup(password)
                externalSystemFlow = true
                createBackupDocument.launch(pendingBackup!!.fileName)
            } catch (error: Exception) {
                pendingBackup = null
                externalSystemFlow = false
                publishNotice(friendlyBackupError(error))
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun shareEncryptedBackup(password: String) {
        if (!canStartSettingsOperation()) return
        activityScope.launch {
            settingsBusy = true
            try {
                val prepared = backupService.prepareEncryptedBackup(password)
                val intent = backupService.createShareIntent(prepared)
                externalSystemFlow = true
                shareBackup.launch(Intent.createChooser(intent, "分享加密薪資備份"))
            } catch (error: Exception) {
                externalSystemFlow = false
                publishNotice(friendlyBackupError(error))
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun restoreEncryptedBackup(@Suppress("UNUSED_PARAMETER") password: String) {
        if (!canStartSettingsOperation()) return
        try {
            restorePickerActive = true
            externalSystemFlow = true
            openBackupDocument.launch(arrayOf("*/*"))
        } catch (error: Exception) {
            restorePickerActive = false
            externalSystemFlow = false
            publishNotice(friendlyBackupError(error))
        }
    }

    private fun unlockImportedBackup(password: String) {
        val content = pendingEncryptedImport ?: return
        activityScope.launch {
            settingsBusy = true
            try {
                restoreCandidate = backupService.prepareRestoreCandidate(content, password)
                pendingEncryptedImport = null
                publishNotice("加密檔案已驗證，請核對摘要後確認。")
            } catch (error: Exception) {
                publishNotice(friendlyBackupError(error))
            } finally { settingsBusy = false }
        }
    }

    private fun confirmRestore() {
        val candidate = restoreCandidate ?: return
        if (settingsBusy) return
        restoreCandidate = null
        activityScope.launch {
            settingsBusy = true
            try {
                when (val result = backupService.applyRestoreCandidate(candidate)) {
                    is NativeSaveResult.Saved -> {
                        refreshSignal++
                        publishNotice(result.message)
                    }
                    is NativeSaveResult.Rejected -> publishNotice(result.message)
                    is NativeSaveResult.NeedsConfirmation -> publishNotice(result.warnings.joinToString("；"))
                }
            } catch (error: Exception) {
                publishNotice(friendlyBackupError(error))
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun cancelRestore() {
        if (settingsBusy) return
        restoreCandidate = null
        publishNotice("已取消還原，現有資料沒有變更。")
    }

    private fun configureLock(enabled: Boolean) {
        if (settingsBusy) return
        security.configureLock(
            enabled = enabled,
            onBusyChanged = { settingsBusy = it },
            onSucceeded = { status ->
                securityStatus = status
                publishNotice(if (enabled) "App 鎖已啟用。" else "App 鎖已停用。")
            },
            onFailed = { message -> publishNotice(message) }
        )
    }

    private fun setScreenProtection(enabled: Boolean) {
        if (settingsBusy) return
        securityStatus = security.setScreenProtectionEnabled(enabled)
        publishNotice(if (enabled) "螢幕保護已啟用。" else "螢幕保護已停用。")
    }

    private fun lockNow() {
        if (!security.isLockEnabled()) {
            publishNotice("請先啟用 App 鎖。")
            return
        }
        lockMessage = "個人薪資管理已鎖定。"
        unlocked = false
    }

    private fun canStartSettingsOperation(): Boolean {
        if (settingsBusy || pendingBackup != null || restorePickerActive || pendingEncryptedImport != null ||
            restoreCandidate != null || externalSystemFlow
        ) {
            publishNotice("另一個安全作業正在進行中。")
            return false
        }
        return true
    }

    private fun publishNotice(message: String) {
        settingsNotice = message
        settingsNoticeSignal++
    }

    private fun friendlyBackupError(error: Exception): String = when (error) {
        is NativeBackupCryptoException -> error.message ?: "加密備份作業失敗。"
        else -> error.message?.takeIf { it.isNotBlank() } ?: "加密備份作業失敗，現有資料沒有變更。"
    }

    private fun requestUnlock() {
        if (unlocked || authenticationBusy || !security.isLockEnabled()) {
            if (!security.isLockEnabled()) unlocked = true
            return
        }
        security.authenticate(
            onBusyChanged = { authenticationBusy = it },
            onSucceeded = {
                lockMessage = "個人薪資管理已鎖定。"
                unlocked = true
                securityStatus = security.currentStatus()
                refreshSignal++
            },
            onFailed = { message -> lockMessage = message }
        )
    }
}
