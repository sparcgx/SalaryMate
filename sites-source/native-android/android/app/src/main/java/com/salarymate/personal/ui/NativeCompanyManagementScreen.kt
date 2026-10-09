package com.salarymate.personal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salarymate.personal.data.NativeCompany
import com.salarymate.personal.data.NativeCompanyBasicsDraft
import com.salarymate.personal.data.NativeLoadState
import com.salarymate.personal.data.NativeSaveResult
import kotlinx.coroutines.launch

@Composable
fun NativeCompanyManagementScreen(
    innerPadding: PaddingValues,
    loadState: NativeLoadState,
    onSaveCompany: suspend (NativeCompanyBasicsDraft) -> NativeSaveResult,
    onSetCurrentCompany: suspend (String) -> NativeSaveResult,
    onOpenWeb: (String?, String?) -> Unit,
    onChanged: (String) -> Unit
) {
    var selectedCompanyId by rememberSaveable { mutableStateOf("") }
    var editCompany by remember { mutableStateOf<NativeCompany?>(null) }
    var addingCompany by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    when (loadState) {
        NativeLoadState.Loading -> Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) { CircularProgressIndicator() }

        is NativeLoadState.Failed -> LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("公司管理", modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
            item { Text(loadState.message, color = MaterialTheme.colorScheme.error) }
            item { OutlinedButton(onClick = { onOpenWeb("companies", "data-health") }) { Text("開啟資料健康檢查") } }
        }

        is NativeLoadState.Empty, is NativeLoadState.Invalid, is NativeLoadState.Ready -> {
            val snapshot = when (loadState) {
                is NativeLoadState.Empty -> loadState.snapshot
                is NativeLoadState.Invalid -> loadState.snapshot
                is NativeLoadState.Ready -> loadState.snapshot
                else -> error("unreachable")
            }
            val invalidMessage = (loadState as? NativeLoadState.Invalid)?.message
            val current = snapshot.currentCompany
            val selected = snapshot.companies.firstOrNull { it.id == selectedCompanyId }
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("公司管理", modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Text("切換目前公司、查看資料，或以最少欄位建立新公司。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Button(enabled = !busy, onClick = { addingCompany = true }) { Text("新增公司") }
                    }
                }

                if (invalidMessage != null) {
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("目前公司設定需要確認", fontWeight = FontWeight.Bold)
                                Text(invalidMessage)
                                Text("下方公司資料仍可查看；請明確選擇一家公司設為目前公司。", color = MaterialTheme.colorScheme.onErrorContainer)
                            }
                        }
                    }
                }

                if (current == null && snapshot.companies.isEmpty()) {
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("尚未建立公司", fontWeight = FontWeight.Bold)
                                Text("建立第一家公司後會自動設為目前公司。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Button(enabled = !busy, onClick = { addingCompany = true }) { Text("建立第一家公司") }
                            }
                        }
                    }
                } else if (current != null) {
                    item {
                        CompanyShellCard(
                            title = "目前公司",
                            company = current,
                            current = true,
                            onView = { selectedCompanyId = current.id },
                            onSetCurrent = {}
                        )
                    }
                }

                item { Text(if (current == null) "可選擇的公司" else "其他公司", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                val others = snapshot.companies.filter { it.id != current?.id }
                if (others.isEmpty()) {
                    item { Text("目前沒有其他公司。", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                } else {
                    items(others.size, key = { others[it].id }) { index ->
                        val company = others[index]
                        CompanyShellCard(
                            title = null,
                            company = company,
                            current = false,
                            onView = { selectedCompanyId = company.id },
                            onSetCurrent = {
                                if (!busy) {
                                    busy = true
                                    scope.launch {
                                        when (val result = onSetCurrentCompany(company.id)) {
                                            is NativeSaveResult.Saved -> onChanged(result.message)
                                            is NativeSaveResult.NeedsConfirmation -> onChanged(result.warnings.joinToString("；"))
                                            is NativeSaveResult.Rejected -> onChanged(result.message)
                                        }
                                        busy = false
                                    }
                                }
                            }
                        )
                    }
                }

                if (selected != null) {
                    item { CompanyDetailCard(selected, current?.id == selected.id, onEdit = { editCompany = selected }, onOpenWeb = onOpenWeb) }
                }
            }
        }
    }


    if (addingCompany || editCompany != null) {
        NativeCompanyBasicsDialog(
            company = editCompany,
            existingCompanies = when (loadState) {
                is NativeLoadState.Empty -> loadState.snapshot.companies
                is NativeLoadState.Invalid -> loadState.snapshot.companies
                is NativeLoadState.Ready -> loadState.snapshot.companies
                else -> emptyList()
            },
            busy = busy,
            onDismiss = {
                addingCompany = false
                editCompany = null
            },
            onSave = { draft ->
                if (!busy) {
                    busy = true
                    scope.launch {
                        when (val result = onSaveCompany(draft)) {
                            is NativeSaveResult.Saved -> {
                                addingCompany = false
                                editCompany = null
                                onChanged(result.message)
                            }
                            is NativeSaveResult.NeedsConfirmation -> onChanged(result.warnings.joinToString("；"))
                            is NativeSaveResult.Rejected -> onChanged(result.message)
                        }
                        busy = false
                    }
                }
            }
        )
    }
}

@Composable
private fun CompanyShellCard(
    title: String?,
    company: NativeCompany,
    current: Boolean,
    onView: () -> Unit,
    onSetCurrent: () -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (title != null) Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Text(company.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                if (company.employmentMode == "dispatch_hourly") "派遣時薪 ${company.baseHourlyRate}"
                else "基本月薪 ${company.baseSalary.toLong()}",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text("到職 ${company.employmentStartDate.ifBlank { "尚未設定" }}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onView) { Text("查看") }
                if (!current) Button(onClick = onSetCurrent) { Text("設為目前公司") }
            }
        }
    }
}

@Composable
private fun CompanyDetailCard(
    company: NativeCompany,
    current: Boolean,
    onEdit: () -> Unit,
    onOpenWeb: (String?, String?) -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("公司詳細資料", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(if (current) "目前使用中" else "查看不會切換目前公司", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("公司名稱：${company.name}")
            Text("到職日：${company.employmentStartDate.ifBlank { "尚未設定" }}")
            Text("薪資週期：${nativePayrollCycleLabel(company.payrollPeriodType)}")
            Text("每日標準工時：${company.workHoursPerDay}")
            Text("薪資規則", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text(if (company.employmentMode == "dispatch_hourly") "基本薪資：時薪 ${company.baseHourlyRate}" else "基本薪資：月薪 ${company.baseSalary.toLong()}")
            Text("固定收入：伙食 ${company.mealAllowance.toLong()}／職務 ${company.positionAllowance.toLong()}／其他 ${company.fixedEarnings.size} 項")
            Text("加班規則：1 / 1.34 / 1.67 / 2 / 2.67；春節 2.5")
            Text("獎金：一般獎金按月輸入；年終規則獨立")
            Text("加項／扣項：單次交易與公司預設分離")
            Text("稅務：總金額 > 86,001 才預扣 5%")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onEdit) { Text("編輯基本資料") }
                if (current) {
                    OutlinedButton(onClick = { onOpenWeb("companies", "company-salary-rules") }) { Text("薪資規則") }
                    OutlinedButton(onClick = { onOpenWeb("companies", "company-advanced-rules") }) { Text("進階設定") }
                } else {
                    OutlinedButton(onClick = { onOpenWeb("companies", "company-full-settings") }) { Text("相容設定") }
                }
            }
        }
    }
}

@Composable
private fun NativeCompanyBasicsDialog(
    company: NativeCompany?,
    existingCompanies: List<NativeCompany>,
    busy: Boolean,
    onDismiss: () -> Unit,
    onSave: (NativeCompanyBasicsDraft) -> Unit
) {
    val initialName = company?.name ?: ""
    val initialSalary = if (company?.employmentMode == "dispatch_hourly") company.baseSalary.toLong().toString() else company?.baseSalary?.toLong()?.toString() ?: "0"
    val initialStartDate = company?.employmentStartDate ?: ""
    var name by remember(company?.id) { mutableStateOf(initialName) }
    var salary by remember(company?.id) { mutableStateOf(initialSalary) }
    var startDate by remember(company?.id) { mutableStateOf(initialStartDate) }
    var attemptedSave by remember(company?.id) { mutableStateOf(false) }
    var confirmDiscard by remember(company?.id) { mutableStateOf(false) }
    val salaryValue = salary.toDoubleOrNull()
    val duplicateName = existingCompanies.any { it.id != company?.id && it.name.trim().equals(name.trim(), ignoreCase = true) }
    val validDate = Regex("\\d{4}-\\d{2}-\\d{2}").matches(startDate)
    val nameError = attemptedSave && name.trim().isBlank()
    val salaryError = attemptedSave && company?.employmentMode != "dispatch_hourly" && (salaryValue == null || salaryValue < 0.0)
    val startDateError = attemptedSave && !validDate
    val valid = !nameError && !salaryError && !startDateError && name.trim().isNotBlank() && (company?.employmentMode == "dispatch_hourly" || (salaryValue != null && salaryValue >= 0.0)) && validDate
    val dirty = name != initialName || salary != initialSalary || startDate != initialStartDate
    fun requestDismiss() {
        if (busy) return
        if (dirty) confirmDiscard = true else onDismiss()
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("放棄未儲存公司資料？") },
            text = { Text("離開後這次尚未儲存的基本資料變更會被捨棄；已儲存資料不受影響。") },
            confirmButton = { TextButton(onClick = onDismiss) { Text("放棄變更") } },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("繼續編輯") } }
        )
        return
    }

    AlertDialog(
        onDismissRequest = { requestDismiss() },
        title = { Text(if (company == null) "新增公司" else "編輯公司基本資料") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; if (attemptedSave) attemptedSave = false },
                    label = { Text("公司名稱") },
                    singleLine = true,
                    isError = nameError,
                    supportingText = { if (nameError) Text("請輸入公司名稱。") }
                )
                if (company?.employmentMode == "dispatch_hourly") {
                    Text("派遣時薪公司的薪資基礎請使用完整公司設定維護。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    OutlinedTextField(
                        value = salary,
                        onValueChange = { salary = it; if (attemptedSave) attemptedSave = false },
                        label = { Text("基本月薪") },
                        singleLine = true,
                        isError = salaryError,
                        supportingText = { if (salaryError) Text("基本月薪必須是 0 以上的數字。") }
                    )
                }
                OutlinedTextField(
                    value = startDate,
                    onValueChange = { startDate = it; if (attemptedSave) attemptedSave = false },
                    label = { Text("到職日 YYYY-MM-DD") },
                    singleLine = true,
                    isError = startDateError,
                    supportingText = { if (startDateError) Text("到職日格式不正確，請輸入 YYYY-MM-DD。") }
                )
                if (duplicateName) {
                    Text("已有相同公司名稱；不同任職期間仍可儲存。", color = MaterialTheme.colorScheme.tertiary)
                }
                if (salaryValue == 0.0 && company?.employmentMode != "dispatch_hourly") {
                    Text("基本月薪為 0 元；允許儲存，但請確認這是預期設定。", color = MaterialTheme.colorScheme.tertiary)
                }
            }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = { requestDismiss() }) { Text("取消") } },
        confirmButton = {
            Button(enabled = !busy, onClick = {
                attemptedSave = true
                if (!valid) return@Button
                onSave(
                    NativeCompanyBasicsDraft(
                        id = company?.id ?: "",
                        name = name.trim(),
                        baseSalary = salaryValue ?: company?.baseSalary ?: 0.0,
                        employmentStartDate = startDate
                    )
                )
            }) { Text(if (company == null) "建立公司" else "儲存") }
        }
    )
}

private fun nativePayrollCycleLabel(value: String): String {
    if (value == "prev16") return "16 日～次月 15 日"
    if (value.startsWith("custom:")) {
        val parts = value.split(':')
        val start = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(1, 31) ?: 1
        val end = parts.getOrNull(2)?.toIntOrNull()?.coerceIn(1, 31) ?: 31
        return "$start 日～${if (start > end) "次月 " else ""}$end 日"
    }
    return "1 日～月底"
}
