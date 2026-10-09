package com.salarymate.personal.ui

import android.app.DatePickerDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.salarymate.personal.data.NativeCompany
import com.salarymate.personal.data.NativeLeaveDraft
import com.salarymate.personal.data.NativeLeaveDuration
import com.salarymate.personal.data.NativeLeaveStatus
import com.salarymate.personal.data.NativeLeaveType
import com.salarymate.personal.data.NativeLoadState
import com.salarymate.personal.data.NativeOvertimeDraft
import com.salarymate.personal.data.NativeOvertimeType
import com.salarymate.personal.data.NativePayrollMath
import com.salarymate.personal.data.NativeSaveResult
import com.salarymate.personal.data.NativeSnapshot
import java.text.DecimalFormat
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import kotlinx.coroutines.launch

enum class QuickEntryKind(val label: String) {
    Overtime("加班"),
    Leave("請假")
}

@Composable
internal fun NativeQuickEntryScreen(
    innerPadding: PaddingValues,
    loadState: NativeLoadState,
    selectedKind: QuickEntryKind,
    onKindSelected: (QuickEntryKind) -> Unit,
    onSaveOvertime: suspend (NativeOvertimeDraft) -> NativeSaveResult,
    onSaveLeave: suspend (NativeLeaveDraft, Boolean) -> NativeSaveResult,
    onOpenWeb: (String?, String?) -> Unit,
    onOpenPayroll: () -> Unit,
    onSaved: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            AppHeader(
                title = "快速登記",
                subtitle = "加班與單日請假直接寫回既有本機快照；進階欄位仍可開啟完整表單。"
            )
        }
        item { QuickKindSelector(selectedKind, onKindSelected) }
        when (loadState) {
            NativeLoadState.Loading -> item { QuickLoadingCard() }
            is NativeLoadState.Failed -> item {
                NativeErrorCard(loadState.message, onOpenHealth = { onOpenWeb("dashboard", "data-health") })
            }
            is NativeLoadState.Empty -> item { NoCompanyCard { onOpenWeb("dashboard", "manage-companies") } }
            is NativeLoadState.Invalid -> item {
                NativeErrorCard(loadState.message, { onOpenWeb("companies", null) }, "前往公司管理")
            }
            is NativeLoadState.Ready -> {
                val snapshot = loadState.snapshot
                run {
                    item {
                        key(selectedKind, snapshot.updatedAt) {
                            if (selectedKind == QuickEntryKind.Overtime) {
                                OvertimeQuickForm(
                                    snapshot = snapshot,
                                    onSave = onSaveOvertime,
                                    onOpenAdvanced = { onOpenWeb("overtime", "add-overtime") },
                                    onSaved = onSaved
                                )
                            } else {
                                LeaveQuickForm(
                                    snapshot = snapshot,
                                    onSave = onSaveLeave,
                                    onOpenAdvanced = { onOpenWeb("overtime", "add-leave") },
                                    onSaved = onSaved
                                )
                            }
                        }
                    }
                    item {
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = onOpenPayroll,
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text("前往原生月度薪資")
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun QuickKindSelector(selected: QuickEntryKind, onSelected: (QuickEntryKind) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        QuickEntryKind.entries.forEach { kind ->
            if (kind == selected) {
                Button(
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    onClick = { onSelected(kind) },
                    shape = RoundedCornerShape(15.dp)
                ) {
                    Text("${if (kind == QuickEntryKind.Overtime) "時" else "假"}｜${kind.label}")
                }
            } else {
                OutlinedButton(
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    onClick = { onSelected(kind) },
                    shape = RoundedCornerShape(15.dp)
                ) {
                    Text("${if (kind == QuickEntryKind.Overtime) "時" else "假"}｜${kind.label}")
                }
            }
        }
    }
}

@Composable
private fun OvertimeQuickForm(
    snapshot: NativeSnapshot,
    onSave: suspend (NativeOvertimeDraft) -> NativeSaveResult,
    onOpenAdvanced: () -> Unit,
    onSaved: (String) -> Unit
) {
    val today = NativePayrollMath.todayIso()
    val initialCompany = requireNotNull(snapshot.currentCompany)
    var date by rememberSaveable { mutableStateOf(today) }
    val companyId = initialCompany.id
    var typeName by rememberSaveable { mutableStateOf(NativePayrollMath.inferOvertimeType(today).name) }
    var hoursText by rememberSaveable { mutableStateOf("2") }
    var rateText by rememberSaveable {
        mutableStateOf(
            suggestedRate(initialCompany, snapshot).takeIf { it > 0 }
                ?.let { String.format(Locale.US, "%.3f", it) } ?: ""
        )
    }
    var customRateText by rememberSaveable { mutableStateOf("1.34") }
    var note by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val company = initialCompany
    val type = NativeOvertimeType.entries.firstOrNull { it.name == typeName } ?: NativeOvertimeType.Weekday
    val hours = hoursText.decimalOrZero()
    val hourlyRate = rateText.decimalOrZero()
    val customRate = customRateText.decimalOrZero()
    val estimated = NativePayrollMath.overtimeAmount(type.storageValue, hours, hourlyRate, customRate)
    val salaryMonth = NativePayrollMath.salaryMonthForDate(date, company.payrollPeriodType)

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        FormCard {
            SectionHeader("每日加班", "星期一至五、星期六與星期天會先帶入建議類型，仍可自行修改。")
            DateSelectionField("加班日期", date) { selected ->
                date = selected
                typeName = NativePayrollMath.inferOvertimeType(selected).name
                error = null
            }
            PayrollIdentityBox("目前公司", company.name)
            FieldLabel("加班類型")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(NativeOvertimeType.entries.size) { index ->
                    val option = NativeOvertimeType.entries[index]
                    ChoiceButton(
                        label = option.label,
                        selected = option == type,
                        tint = SalaryBlue,
                        onClick = { typeName = option.name; error = null }
                    )
                }
            }
            Text(
                type.explanation,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            FieldLabel("常用時數")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(5) { index ->
                    val shortcut = listOf(1.0, 2.0, 3.0, 4.0, 8.0)[index]
                    ChoiceButton(
                        label = "${shortcut.cleanNumber()}h",
                        selected = hours == shortcut,
                        tint = SalaryTeal,
                        onClick = { hoursText = shortcut.cleanNumber(); error = null }
                    )
                }
            }
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = hoursText,
                onValueChange = { hoursText = it.filterDecimal(5); error = null },
                label = { Text("加班時數") },
                suffix = { Text("小時") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = rateText,
                onValueChange = { rateText = it.filterDecimal(9); error = null },
                label = { Text("每日加班時薪") },
                prefix = { Text("$") },
                supportingText = { Text("以三位小數快照保存，之後調薪不會回溯修改。") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            if (type == NativeOvertimeType.Custom) {
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = customRateText,
                    onValueChange = { customRateText = it.filterDecimal(6); error = null },
                    label = { Text("自訂固定倍率") },
                    suffix = { Text("×") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = note,
                onValueChange = { if (it.length <= 160) note = it },
                label = { Text("備註／事由（選填）") },
                minLines = 2,
                maxLines = 3
            )
        }
        CalculationPreview(
            title = "預估本次加班費",
            value = money(estimated),
            detail = salaryMonth?.let {
                "歸屬 ${it.year} 年 ${it.month} 月薪資｜${NativePayrollMath.salaryPeriodLabel(it, company.payrollPeriodType)}"
            } ?: "請確認日期"
        )
        error?.let { FormError(it) }
        Button(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            enabled = !busy,
            shape = RoundedCornerShape(17.dp),
            onClick = {
                busy = true
                error = null
                scope.launch {
                    val result = runCatching {
                        onSave(
                            NativeOvertimeDraft(
                                date = date,
                                companyId = companyId,
                                type = type,
                                hours = hours,
                                hourlyRate = hourlyRate,
                                customRate = customRate,
                                note = note
                            )
                        )
                    }.getOrElse { NativeSaveResult.Rejected("儲存失敗，資料未變更。請重新整理後再試。") }
                    busy = false
                    when (result) {
                        is NativeSaveResult.Saved -> onSaved(result.message)
                        is NativeSaveResult.Rejected -> error = result.message
                        is NativeSaveResult.NeedsConfirmation -> error = result.warnings.joinToString("；")
                    }
                }
            }
        ) {
            if (busy) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                Spacer(Modifier.size(10.dp))
                Text("正在安全儲存…")
            } else {
                Text("儲存加班紀錄")
            }
        }
        TextButton(modifier = Modifier.fillMaxWidth(), onClick = onOpenAdvanced) {
            Text("需要編輯歷史紀錄？開啟完整加班管理")
        }
    }
}

@Composable
private fun LeaveQuickForm(
    snapshot: NativeSnapshot,
    onSave: suspend (NativeLeaveDraft, Boolean) -> NativeSaveResult,
    onOpenAdvanced: () -> Unit,
    onSaved: (String) -> Unit
) {
    val today = NativePayrollMath.todayIso()
    val initialCompany = requireNotNull(snapshot.currentCompany)
    var date by rememberSaveable { mutableStateOf(today) }
    val companyId = initialCompany.id
    var typeName by rememberSaveable { mutableStateOf(NativeLeaveType.Annual.name) }
    var durationName by rememberSaveable { mutableStateOf(NativeLeaveDuration.FullDay.name) }
    var hoursText by rememberSaveable { mutableStateOf("1") }
    var statusName by rememberSaveable { mutableStateOf(NativeLeaveStatus.Planned.name) }
    var paidRatioText by rememberSaveable { mutableStateOf("100") }
    var note by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var pendingWarnings by remember { mutableStateOf<List<String>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val company = initialCompany
    val type = NativeLeaveType.entries.firstOrNull { it.name == typeName } ?: NativeLeaveType.Annual
    val duration = NativeLeaveDuration.entries.firstOrNull { it.name == durationName } ?: NativeLeaveDuration.FullDay
    val status = NativeLeaveStatus.entries.firstOrNull { it.name == statusName } ?: NativeLeaveStatus.Planned
    val customHours = hoursText.decimalOrZero()
    val paidRatio = paidRatioText.toIntOrNull() ?: -1
    val convertedHours = when (duration) {
        NativeLeaveDuration.FullDay -> company.workHoursPerDay
        NativeLeaveDuration.HalfMorning, NativeLeaveDuration.HalfAfternoon -> company.workHoursPerDay / 2
        NativeLeaveDuration.Hours -> customHours
    }
    val salaryMonth = NativePayrollMath.salaryMonthForDate(date, company.payrollPeriodType)

    fun submit(allowWarnings: Boolean) {
        busy = true
        error = null
        scope.launch {
            val result = runCatching {
                onSave(
                    NativeLeaveDraft(
                        date = date,
                        companyId = companyId,
                        type = type,
                        duration = duration,
                        customHours = customHours,
                        status = status,
                        paidRatio = paidRatio,
                        note = note
                    ),
                    allowWarnings
                )
            }.getOrElse { NativeSaveResult.Rejected("儲存失敗，資料未變更。請重新整理後再試。") }
            busy = false
            when (result) {
                is NativeSaveResult.Saved -> {
                    pendingWarnings = emptyList()
                    onSaved(result.message)
                }
                is NativeSaveResult.Rejected -> error = result.message
                is NativeSaveResult.NeedsConfirmation -> pendingWarnings = result.warnings
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        FormCard {
            SectionHeader("單日請假", "快速表單適合整天、半天與小時請假；跨日請使用完整表單。")
            DateSelectionField("請假日期", date) { date = it; error = null }
            PayrollIdentityBox("目前公司", company.name)
            SelectionField(
                label = "假別",
                selectedLabel = type.label,
                options = NativeLeaveType.entries.map { it.name to it.label },
                onSelected = { name ->
                    val selected = NativeLeaveType.entries.first { it.name == name }
                    typeName = selected.name
                    paidRatioText = selected.defaultPaidRatio.toString()
                    error = null
                }
            )
            FieldLabel("請假區段")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(NativeLeaveDuration.entries.size) { index ->
                    val option = NativeLeaveDuration.entries[index]
                    ChoiceButton(
                        label = option.label,
                        selected = option == duration,
                        tint = SalaryTeal,
                        onClick = { durationName = option.name; error = null }
                    )
                }
            }
            if (duration == NativeLeaveDuration.Hours) {
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = hoursText,
                    onValueChange = { hoursText = it.filterDecimal(5); error = null },
                    label = { Text("請假時數") },
                    suffix = { Text("小時") },
                    supportingText = { Text("此公司每日標準工時 ${company.workHoursPerDay.cleanNumber()} 小時。") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }
            SelectionField(
                label = "流程狀態",
                selectedLabel = status.label,
                options = NativeLeaveStatus.entries.map { it.name to it.label },
                onSelected = { statusName = it; error = null }
            )
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = paidRatioText,
                onValueChange = { paidRatioText = it.filter { char -> char.isDigit() }.take(3); error = null },
                label = { Text("給薪比例") },
                suffix = { Text("%") },
                supportingText = { Text("0% 無薪、50% 半薪、100% 全薪。") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = note,
                onValueChange = { if (it.length <= 160) note = it },
                label = { Text("備註／事由（選填）") },
                minLines = 2,
                maxLines = 3
            )
        }
        CalculationPreview(
            title = "換算請假時數",
            value = "${convertedHours.cleanNumber()} 小時",
            detail = salaryMonth?.let {
                "歸屬 ${it.year} 年 ${it.month} 月薪資｜給薪比例 ${paidRatio.coerceAtLeast(0)}%"
            } ?: "請確認日期"
        )
        InfoCard(
            title = "快速表單邊界",
            text = "全勤／出勤扣款預設為 0；跨日、週末納入與進階額度調整請使用完整請假表單。"
        )
        error?.let { FormError(it) }
        Button(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            enabled = !busy,
            shape = RoundedCornerShape(17.dp),
            onClick = { submit(false) }
        ) {
            if (busy) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                Spacer(Modifier.size(10.dp))
                Text("正在安全儲存…")
            } else {
                Text("儲存請假紀錄")
            }
        }
        TextButton(modifier = Modifier.fillMaxWidth(), onClick = onOpenAdvanced) {
            Text("跨日或進階扣款？開啟完整請假表單")
        }
    }

    if (pendingWarnings.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = { if (!busy) pendingWarnings = emptyList() },
            title = { Text("儲存前請確認") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pendingWarnings.forEach { Text("• $it") }
                    Text("若內容正確，可仍然保存此筆紀錄。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            confirmButton = {
                TextButton(enabled = !busy, onClick = { submit(true) }) { Text("仍要儲存") }
            },
            dismissButton = {
                TextButton(enabled = !busy, onClick = { pendingWarnings = emptyList() }) { Text("返回修改") }
            }
        )
    }
}

@Composable
internal fun FormCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp),
            content = content
        )
    }
}

@Composable
internal fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
internal fun DateSelectionField(label: String, value: String, onSelected: (String) -> Unit) {
    val context = LocalContext.current
    OutlinedButton(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(13.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        onClick = {
            val parts = NativePayrollMath.parseIsoDate(value)
            val calendar = Calendar.getInstance()
            val year = parts?.first ?: calendar.get(Calendar.YEAR)
            val month = (parts?.second ?: calendar.get(Calendar.MONTH) + 1) - 1
            val day = parts?.third ?: calendar.get(Calendar.DAY_OF_MONTH)
            DatePickerDialog(
                context,
                { _, selectedYear, selectedMonth, selectedDay ->
                    onSelected(String.format(Locale.US, "%04d-%02d-%02d", selectedYear, selectedMonth + 1, selectedDay))
                },
                year,
                month,
                day
            ).show()
        }
    ) {
        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value.replace('-', '/'), style = MaterialTheme.typography.titleMedium)
        }
        Text("選擇", color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
internal fun SelectionField(
    label: String,
    selectedLabel: String,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit
) {
    var open by remember { mutableStateOf(false) }
    OutlinedButton(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(13.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        onClick = { open = true }
    ) {
        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(selectedLabel, style = MaterialTheme.typography.titleMedium, maxLines = 1)
        }
        Text("選擇", color = MaterialTheme.colorScheme.primary)
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text("選擇$label") },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = 360.dp)) {
                    items(options.size) { index ->
                        val option = options[index]
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .semantics(mergeDescendants = true) {
                                    role = Role.Button
                                    stateDescription = if (option.second == selectedLabel) "已選取" else "未選取"
                                }
                                .clickable {
                                    onSelected(option.first)
                                    open = false
                                }
                                .padding(vertical = 13.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(option.second, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                            if (option.second == selectedLabel) Text("✓", color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { open = false }) { Text("取消") }
            }
        )
    }
}

@Composable
internal fun ChoiceButton(
    label: String,
    selected: Boolean,
    tint: Color,
    onClick: () -> Unit
) {
    if (selected) {
        Button(
            onClick = onClick,
            shape = RoundedCornerShape(13.dp),
            colors = ButtonDefaults.buttonColors(containerColor = tint),
            contentPadding = PaddingValues(horizontal = 15.dp, vertical = 9.dp)
        ) { Text(label) }
    } else {
        OutlinedButton(
            onClick = onClick,
            shape = RoundedCornerShape(13.dp),
            contentPadding = PaddingValues(horizontal = 15.dp, vertical = 9.dp)
        ) { Text(label) }
    }
}

@Composable
internal fun CalculationPreview(title: String, value: String, detail: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(21.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text(value, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
private fun InfoCard(title: String, text: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.secondaryContainer
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
        }
    }
}

@Composable
internal fun FormError(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.errorContainer
    ) {
        Text(
            message,
            modifier = Modifier.padding(15.dp),
            color = MaterialTheme.colorScheme.onErrorContainer,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun QuickLoadingCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            Text("正在準備公司與最近時薪…", style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
internal fun NoCompanyCard(onCreateCompany: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("快速登記需要公司資料", style = MaterialTheme.typography.titleLarge)
            Text("先設定公司與薪資規則，才能正確判斷計薪區間與每日工時。")
            Button(onClick = onCreateCompany) { Text("前往公司管理") }
        }
    }
}

private fun suggestedRate(company: NativeCompany, snapshot: NativeSnapshot): Double =
    if (company.employmentMode == "dispatch_hourly" && company.baseHourlyRate > 0) company.baseHourlyRate
    else snapshot.latestOvertimeRate

internal fun companyDisplayName(company: NativeCompany): String =
    "${if (company.isCurrent) "現任｜" else "歷任｜"}${company.name}"

internal fun String.filterDecimal(maxLength: Int): String {
    val normalized = replace(',', '.')
    val filtered = buildString {
        var dotSeen = false
        normalized.forEach { char ->
            if (char.isDigit()) append(char)
            else if (char == '.' && !dotSeen) {
                append(char)
                dotSeen = true
            }
        }
    }
    return filtered.take(maxLength)
}

internal fun String.decimalOrZero(): Double = replace(',', '.').toDoubleOrNull() ?: 0.0

internal fun Double.cleanNumber(): String = DecimalFormat("0.###").format(this)

internal fun money(value: Long): String = "NT$ " + NumberFormat.getIntegerInstance(Locale.TAIWAN).format(value)
