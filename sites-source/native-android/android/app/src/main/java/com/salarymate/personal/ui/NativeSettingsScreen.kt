package com.salarymate.personal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.salarymate.personal.NativeSecurityStatus
import com.salarymate.personal.data.NativeLoadState

private enum class BackupDialogMode {
    Save,
    Share,
    Restore
}

@Composable
internal fun NativeSettingsScreen(
    innerPadding: PaddingValues,
    loadState: NativeLoadState,
    securityStatus: NativeSecurityStatus,
    busy: Boolean,
    onSaveBackup: (String) -> Unit,
    onShareBackup: (String) -> Unit,
    onRestoreBackup: (String) -> Unit,
    encryptedImportPending: Boolean,
    onUnlockImport: (String) -> Unit,
    onCancelImport: () -> Unit,
    restorePreview: String?,
    onConfirmRestore: () -> Unit,
    onCancelRestore: () -> Unit,
    onConfigureLock: (Boolean) -> Unit,
    onSetScreenProtection: (Boolean) -> Unit,
    onLockNow: () -> Unit,
    onOpenWeb: (String?, String?) -> Unit
) {
    var dialogMode by remember { mutableStateOf<BackupDialogMode?>(null) }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var passwordError by remember { mutableStateOf<String?>(null) }

    fun openPasswordDialog(mode: BackupDialogMode) {
        password = ""
        confirmation = ""
        passwordError = null
        dialogMode = mode
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            AppHeader(
                title = "資料與安全",
                subtitle = "加密備份、還原、App 鎖與螢幕保護已可直接在原生介面完成。"
            )
        }
        item { NativeDataStatusCard(loadState) }
        item {
            NativeBackupActionsCard(
                busy = busy,
                onSave = { onSaveBackup("") },
                onShare = { openPasswordDialog(BackupDialogMode.Share) },
                onEncryptedSave = { openPasswordDialog(BackupDialogMode.Save) },
                onRestore = { onRestoreBackup("") }
            )
        }
        item {
            NativeSecurityCard(
                status = securityStatus,
                busy = busy,
                onConfigureLock = onConfigureLock,
                onSetScreenProtection = onSetScreenProtection,
                onLockNow = onLockNow
            )
        }
        item { NativeAdvancedSettingsCard(busy = busy, onOpenWeb = onOpenWeb) }
        item { Spacer(Modifier.height(4.dp)) }
    }

    val activeMode = if (encryptedImportPending) BackupDialogMode.Restore else dialogMode
    activeMode?.let { mode ->
        NativeBackupPasswordDialog(
            mode = mode,
            password = password,
            confirmation = confirmation,
            error = passwordError,
            busy = busy,
            onPasswordChanged = {
                password = it
                passwordError = null
            },
            onConfirmationChanged = {
                confirmation = it
                passwordError = null
            },
            onDismiss = { if (!busy) { dialogMode = null; if (encryptedImportPending) onCancelImport() } },
            onConfirm = {
                val creating = mode != BackupDialogMode.Restore
                passwordError = when {
                    password.isEmpty() -> "請輸入備份密碼"
                    creating && password.codePointCount(0, password.length) < 12 -> "備份密碼至少需要 12 個字元"
                    creating && password != confirmation -> "兩次輸入的密碼不一致"
                    else -> null
                }
                if (passwordError == null) {
                    val submittedPassword = password
                    password = ""
                    confirmation = ""
                    dialogMode = null
                    when (mode) {
                        BackupDialogMode.Save -> onSaveBackup(submittedPassword)
                        BackupDialogMode.Share -> onShareBackup(submittedPassword)
                        BackupDialogMode.Restore -> onUnlockImport(submittedPassword)
                    }
                }
            }
        )
    }

    if (restorePreview != null) {
        AlertDialog(
            onDismissRequest = { if (!busy) onCancelRestore() },
            title = { Text("核對還原內容") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("備份已通過密碼與格式驗證：")
                    Text(restorePreview, style = MaterialTheme.typography.titleMedium)
                    Text("確認後會將這份資料設為最新快照；取消不會變更目前資料。")
                }
            },
            confirmButton = {
                TextButton(onClick = onConfirmRestore, enabled = !busy) { Text("確認還原") }
            },
            dismissButton = {
                TextButton(onClick = onCancelRestore, enabled = !busy) { Text("取消") }
            }
        )
    }
}

@Composable
private fun NativeAdvancedSettingsCard(
    busy: Boolean,
    onOpenWeb: (String?, String?) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            SectionHeader("完整管理設定", "保留公司、介面與舊版資料遷移入口。")
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onOpenWeb("dashboard", "manage-companies") },
                enabled = !busy
            ) { Text("公司管理") }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onOpenWeb("dashboard", "open-interface-settings") },
                enabled = !busy
            ) { Text("介面與版面") }
            OutlinedButton(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                onClick = { onOpenWeb("dashboard", "data-health") },
                enabled = !busy,
                shape = RoundedCornerShape(16.dp)
            ) { Text("進階資料健康檢查與舊版遷移") }
        }
    }
}

@Composable
private fun NativeDataStatusCard(loadState: NativeLoadState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Text("目前資料快照", style = MaterialTheme.typography.titleMedium)
            when (loadState) {
                NativeLoadState.Loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.size(10.dp))
                    Text("正在安全讀取…")
                }
                is NativeLoadState.Failed -> Text(loadState.message, color = MaterialTheme.colorScheme.error)
                is NativeLoadState.Empty -> Text("目前尚未建立薪資資料；這是正常的空白狀態。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                is NativeLoadState.Invalid -> {
                    val snapshot = loadState.snapshot
                    Text(
                        "公司 ${snapshot.companyCount}｜薪資 ${snapshot.salaryRecordCount}｜加班 ${snapshot.overtimeRecordCount}｜請假 ${snapshot.leaveRecordCount}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(loadState.message, color = MaterialTheme.colorScheme.error)
                }
                is NativeLoadState.Ready -> {
                    val snapshot = loadState.snapshot
                    Text(
                        "公司 ${snapshot.companyCount}｜薪資 ${snapshot.salaryRecordCount}｜加班 ${snapshot.overtimeRecordCount}｜請假 ${snapshot.leaveRecordCount}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        if (snapshot.updatedAt.isBlank()) "尚無快照時間" else "最後更新 ${snapshot.updatedAt}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun NativeBackupActionsCard(
    busy: Boolean,
    onSave: () -> Unit,
    onShare: () -> Unit,
    onEncryptedSave: () -> Unit,
    onRestore: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            SectionHeader("資料匯入／匯出", "一般匯出免密碼；檔案含薪資資料，請存於可信任位置。")
            Button(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                onClick = onSave,
                enabled = !busy,
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(if (busy) "作業進行中…" else "匯出 .salarymate")
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = onEncryptedSave,
                enabled = !busy
            ) {
                Text("選用密碼加密匯出")
            }
            HorizontalDivider()
            Text(
                "匯入先驗證檔案與 Schema；只有加密檔案要求原密碼，確認後才寫入。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = onRestore,
                enabled = !busy
            ) {
                Text("匯入 .salarymate 或舊版備份")
            }
        }
    }
}

@Composable
private fun NativeSecurityCard(
    status: NativeSecurityStatus,
    busy: Boolean,
    onConfigureLock: (Boolean) -> Unit,
    onSetScreenProtection: (Boolean) -> Unit,
    onLockNow: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            SectionHeader("App 存取保護", "變更 App 鎖前必須通過 Android 系統驗證。")
            SecuritySettingRow(
                title = "App 鎖",
                description = if (status.available) "離開後自動鎖定，使用裝置憑證解鎖" else "請先在 Android 設定螢幕鎖或生物辨識",
                checked = status.lockEnabled,
                enabled = !busy && status.available,
                onCheckedChange = onConfigureLock
            )
            HorizontalDivider()
            SecuritySettingRow(
                title = "螢幕保護",
                description = "阻擋截圖、錄影與最近使用畫面預覽",
                checked = status.screenProtectionEnabled,
                enabled = !busy,
                onCheckedChange = onSetScreenProtection
            )
            if (status.lockEnabled) {
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onLockNow,
                    enabled = !busy
                ) {
                    Text("立即鎖定")
                }
            }
        }
    }
}

@Composable
private fun SecuritySettingRow(
    title: String,
    description: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

@Composable
private fun NativeBackupPasswordDialog(
    mode: BackupDialogMode,
    password: String,
    confirmation: String,
    error: String?,
    busy: Boolean,
    onPasswordChanged: (String) -> Unit,
    onConfirmationChanged: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val creating = mode != BackupDialogMode.Restore
    val title = when (mode) {
        BackupDialogMode.Save -> "加密並另存備份"
        BackupDialogMode.Share -> "加密並分享備份"
        BackupDialogMode.Restore -> "解鎖並還原備份"
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    if (creating) "請設定至少 12 個字元的備份密碼。忘記密碼將無法還原。"
                    else "此檔案已加密。輸入原備份密碼後會驗證內容，確認前不會寫入資料。"
                )
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = password,
                    onValueChange = onPasswordChanged,
                    label = { Text("備份密碼") },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true,
                    enabled = !busy
                )
                if (creating) {
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = confirmation,
                        onValueChange = onConfirmationChanged,
                        label = { Text("再次輸入密碼") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        enabled = !busy
                    )
                }
                if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !busy) {
                Text(if (mode == BackupDialogMode.Restore) "解密並核對" else "繼續")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !busy) { Text("取消") }
        }
    )
}
