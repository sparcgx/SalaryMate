package com.salarymate.personal.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.salarymate.personal.NativeSecurityStatus
import com.salarymate.personal.data.NativeLoadState
import com.salarymate.personal.data.NativeSalaryMateRepository
import com.salarymate.personal.data.NativeSnapshot
import kotlinx.coroutines.launch

private enum class ShellDestination(
    val label: String,
    val shortLabel: String
) {
    Home("首頁", "首"),
    Payroll("薪資", "薪"),
    Annual("年度總覽", "年"),
    Company("公司管理", "公"),
    Settings("設定", "設")
}

private data class WebEntry(
    val title: String,
    val description: String,
    val badge: String,
    val tint: Color,
    val tab: String? = null,
    val action: String? = null
)

private fun classifyNativeLoadState(snapshot: NativeSnapshot): NativeLoadState = when {
    !snapshot.hasSnapshot || snapshot.companies.isEmpty() -> NativeLoadState.Empty(snapshot)
    snapshot.currentCompany == null -> NativeLoadState.Invalid(
        snapshot,
        "目前公司設定資料需要確認。請前往公司管理明確選擇目前公司。系統不會自動改用第一家公司。"
    )
    else -> NativeLoadState.Ready(snapshot)
}

@Composable
fun SalaryMateShell(
    repository: NativeSalaryMateRepository,
    externalRefreshSignal: Int,
    securityStatus: NativeSecurityStatus,
    settingsBusy: Boolean,
    settingsNotice: String?,
    settingsNoticeSignal: Int,
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
    onOpenWeb: (tab: String?, action: String?) -> Unit
) {
    var selectedName by rememberSaveable { mutableStateOf(ShellDestination.Home.name) }
    var refreshToken by remember { mutableIntStateOf(0) }
    var loadState by remember { mutableStateOf<NativeLoadState>(NativeLoadState.Loading) }
    var payrollDraftDirty by rememberSaveable { mutableStateOf(false) }
    var pendingDestinationName by rememberSaveable { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val selected = ShellDestination.entries.firstOrNull { it.name == selectedName }
        ?: ShellDestination.Home

    fun requestDestination(destination: ShellDestination) {
        if (selected == ShellDestination.Payroll && destination != ShellDestination.Payroll && payrollDraftDirty) {
            pendingDestinationName = destination.name
        } else {
            selectedName = destination.name
        }
    }

    BackHandler(enabled = selected != ShellDestination.Home) {
        selectedName = ShellDestination.Home.name
    }

    LaunchedEffect(externalRefreshSignal, refreshToken) {
        loadState = NativeLoadState.Loading
        loadState = try {
            classifyNativeLoadState(repository.loadSnapshot())
        } catch (_: Exception) {
            NativeLoadState.Failed("無法安全讀取本機薪資資料。系統不會把讀取失敗當成空資料，也不會自動清除現有 App 資料。")
        }
    }

    LaunchedEffect(settingsNoticeSignal) {
        if (settingsNoticeSignal > 0 && !settingsNotice.isNullOrBlank()) {
            snackbarHostState.showSnackbar(settingsNotice)
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            SalaryMateBottomBar(
                selected = selected,
                onSelected = ::requestDestination
            )
        }
    ) { innerPadding ->
        when (selected) {
            ShellDestination.Home -> NativeHomeScreen(
                innerPadding = innerPadding,
                loadState = loadState,
                onRefresh = { refreshToken++ },
                onOpenPayroll = { selectedName = ShellDestination.Payroll.name },
                onOpenWeb = onOpenWeb
            )
            ShellDestination.Payroll -> NativePayrollScreen(
                innerPadding = innerPadding,
                loadState = loadState,
                onPrepare = repository::prepareSalaryDraft,
                onSave = repository::saveSalaryRecord,
                onDelete = repository::deleteSalaryRecord,
                onOpenWeb = onOpenWeb,
                onDraftDirtyChanged = { payrollDraftDirty = it },
                onSaved = { message ->
                    refreshToken++
                    scope.launch { snackbarHostState.showSnackbar(message) }
                }
            )
            ShellDestination.Company -> NativeCompanyManagementScreen(
                innerPadding = innerPadding,
                loadState = loadState,
                onSaveCompany = repository::saveCompanyBasics,
                onSetCurrentCompany = repository::setCurrentCompany,
                onOpenWeb = onOpenWeb,
                onChanged = { message ->
                    refreshToken++
                    scope.launch { snackbarHostState.showSnackbar(message) }
                }
            )
            ShellDestination.Annual -> AnnualOverviewEntry(innerPadding, onOpenWeb)
            ShellDestination.Settings -> NativeSettingsScreen(
                innerPadding = innerPadding,
                loadState = loadState,
                securityStatus = securityStatus,
                busy = settingsBusy,
                onSaveBackup = onSaveBackup,
                onShareBackup = onShareBackup,
                onRestoreBackup = onRestoreBackup,
                encryptedImportPending = encryptedImportPending,
                onUnlockImport = onUnlockImport,
                onCancelImport = onCancelImport,
                restorePreview = restorePreview,
                onConfirmRestore = onConfirmRestore,
                onCancelRestore = onCancelRestore,
                onConfigureLock = onConfigureLock,
                onSetScreenProtection = onSetScreenProtection,
                onLockNow = onLockNow,
                onOpenWeb = onOpenWeb
            )
        }
    }

    if (pendingDestinationName.isNotBlank()) {
        val pendingDestination = ShellDestination.entries.firstOrNull { it.name == pendingDestinationName }
        AlertDialog(
            onDismissRequest = { pendingDestinationName = "" },
            title = { Text("放棄未儲存薪資草稿？") },
            text = { Text("切換功能前需要先處理目前薪資草稿。放棄後，已儲存資料不受影響。") },
            confirmButton = {
                TextButton(onClick = {
                    payrollDraftDirty = false
                    pendingDestinationName = ""
                    if (pendingDestination != null) selectedName = pendingDestination.name
                }) { Text("放棄變更") }
            },
            dismissButton = { TextButton(onClick = { pendingDestinationName = "" }) { Text("繼續編輯") } }
        )
    }
}

@Composable
private fun SalaryMateBottomBar(
    selected: ShellDestination,
    onSelected: (ShellDestination) -> Unit
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp
    ) {
        ShellDestination.entries.forEach { destination ->
            NavigationBarItem(
                selected = selected == destination,
                onClick = { onSelected(destination) },
                icon = {
                    Box(
                        modifier = Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selected == destination) MaterialTheme.colorScheme.primaryContainer
                                else Color.Transparent
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = destination.shortLabel,
                            modifier = Modifier.clearAndSetSemantics { },
                            style = MaterialTheme.typography.labelLarge,
                            color = if (selected == destination) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                label = { Text(destination.label) },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = Color.Transparent,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}

@Composable
private fun AnnualOverviewEntry(
    innerPadding: PaddingValues,
    onOpenWeb: (String?, String?) -> Unit
) {
    val entries = listOf(
        WebEntry("收入總覽", "年度實領、趨勢與任職狀態。", "總", SalaryBlue, "dashboard"),
        WebEntry("薪資紀錄", "每月薪資、加項與扣項明細。", "薪", SalaryOrange, "records"),
        WebEntry("工時／出勤", "加班、請假及額度使用狀態。", "勤", SalaryTeal, "overtime"),
        WebEntry("薪資試算", "加班費、年終、調薪與時間價值。", "算", SalaryRose, "hourly"),
        WebEntry("報稅助手", "整理年度所得與預扣資訊。", "稅", Color(0xFF7C3AED), "tax")
    )
    EntryListScreen(
        innerPadding = innerPadding,
        title = "年度總覽",
        subtitle = "複雜表格、進階計算與歷史資料維護沿用成熟核心。",
        entries = entries,
        onOpenWeb = onOpenWeb
    )
}

@Composable
private fun EntryListScreen(
    innerPadding: PaddingValues,
    title: String,
    subtitle: String,
    entries: List<WebEntry>,
    onOpenWeb: (String?, String?) -> Unit,
    footer: (@Composable () -> Unit)? = null
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { AppHeader(title, subtitle) }
        items(entries.size) { index ->
            val entry = entries[index]
            FullWidthEntryCard(entry) { onOpenWeb(entry.tab, entry.action) }
        }
        if (footer != null) item { footer() }
        item { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
internal fun AppHeader(title: String, subtitle: String, trailing: (@Composable () -> Unit)? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "個人薪資管理",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.secondary
                )
                Text(text = title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
            }
            if (trailing != null) trailing() else AppMonogram()
        }
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AppMonogram() {
    Surface(
        modifier = Modifier.size(48.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = "SM",
                modifier = Modifier.clearAndSetSemantics { },
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
internal fun SectionHeader(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
internal fun NativeErrorCard(
    message: String,
    onOpenHealth: () -> Unit,
    actionLabel: String = "開啟資料健康檢查",
    onRetry: (() -> Unit)? = null
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("資料暫時保持鎖定", style = MaterialTheme.typography.titleMedium)
            Text(message, style = MaterialTheme.typography.bodyMedium)
            if (onRetry != null) Button(onClick = onRetry) { Text("重新讀取") }
            OutlinedButton(onClick = onOpenHealth) { Text(actionLabel) }
        }
    }
}

@Composable
private fun FullWidthEntryCard(entry: WebEntry, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Surface(
                modifier = Modifier.size(46.dp),
                shape = RoundedCornerShape(14.dp),
                color = entry.tint.copy(alpha = 0.12f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(entry.badge, color = entry.tint, fontWeight = FontWeight.Bold)
                }
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(entry.title, style = MaterialTheme.typography.titleMedium)
                Text(
                    entry.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text("›", style = MaterialTheme.typography.titleLarge, color = entry.tint)
        }
    }
}

@Composable
fun SalaryMateLockedScreen(
    message: String,
    busy: Boolean,
    onUnlock: () -> Unit,
    onLeave: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Surface(
                modifier = Modifier.size(78.dp),
                shape = RoundedCornerShape(26.dp),
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("鎖", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.height(24.dp))
            Text("薪資資料已保護", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Text(
                message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(28.dp))
            Button(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                onClick = onUnlock,
                enabled = !busy,
                shape = RoundedCornerShape(17.dp)
            ) {
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.size(10.dp))
                    Text("正在驗證…")
                } else {
                    Text("使用裝置解鎖")
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = onLeave,
                enabled = !busy
            ) {
                Text("稍後再使用")
            }
        }
    }
}
