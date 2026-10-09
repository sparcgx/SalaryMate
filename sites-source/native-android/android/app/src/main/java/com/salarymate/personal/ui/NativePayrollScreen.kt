package com.salarymate.personal.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.salarymate.personal.data.NativeCompany
import com.salarymate.personal.data.NativeLoadState
import com.salarymate.personal.data.NativeMoneyItem
import com.salarymate.personal.data.NativePayrollMath
import com.salarymate.personal.data.NativeSalaryDraft
import com.salarymate.personal.data.NativeSalaryDraftResult
import com.salarymate.personal.data.NativeSalaryRecord
import com.salarymate.personal.data.NativeSaveResult
import com.salarymate.personal.data.NativeSnapshot
import java.util.Calendar
import kotlin.math.roundToLong
import kotlinx.coroutines.launch

@Composable
internal fun NativePayrollScreen(
    innerPadding: PaddingValues,
    loadState: NativeLoadState,
    onPrepare: suspend (String?, Int, Int, String, String) -> NativeSalaryDraftResult,
    onSave: suspend (NativeSalaryDraft) -> NativeSaveResult,
    onDelete: suspend (String) -> NativeSaveResult,
    onOpenWeb: (String?, String?) -> Unit,
    onDraftDirtyChanged: (Boolean) -> Unit,
    onSaved: (String) -> Unit
) {
    var activeDraft by remember { mutableStateOf<NativeSalaryDraft?>(null) }
    var draftDirty by remember { mutableStateOf(false) }
    var draftRevision by remember { mutableIntStateOf(0) }
    var preparing by remember { mutableStateOf(false) }
    var screenError by remember { mutableStateOf<String?>(null) }
    var pendingDelete by remember { mutableStateOf<NativeSalaryRecord?>(null) }
    var pendingDraftDiscard by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    BackHandler(enabled = activeDraft != null && draftDirty) { pendingDraftDiscard = true }

    fun setDraftDirty(value: Boolean) {
        draftDirty = value
        onDraftDirtyChanged(value)
    }

    fun prepare(
        companyId: String?,
        year: Int,
        month: Int,
        recordId: String = "",
        copyFromId: String = ""
    ) {
        if (preparing) return
        preparing = true
        screenError = null
        scope.launch {
            val result = runCatching { onPrepare(companyId, year, month, recordId, copyFromId) }
                .getOrElse { NativeSalaryDraftResult.Rejected("無法準備薪資表單，資料未變更。") }
            preparing = false
            when (result) {
                is NativeSalaryDraftResult.Ready -> {
                    activeDraft = result.draft
                    setDraftDirty(false)
                    draftRevision++
                }
                is NativeSalaryDraftResult.Rejected -> screenError = result.message
            }
        }
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
                title = if (activeDraft == null) "薪資紀錄" else if (activeDraft?.id.isNullOrBlank()) "快速建立薪資" else "編輯薪資",
                subtitle = if (activeDraft == null) {
                    "月薪快照、實領金額與常用維護直接在原生介面完成。"
                } else {
                    "共用 Schema 13；儲存前可核對應發、扣除與實際入帳。"
                }
            )
        }

        when (loadState) {
            NativeLoadState.Loading -> item { PayrollLoadingCard("正在讀取薪資紀錄…") }
            is NativeLoadState.Failed -> item {
                NativeErrorCard(loadState.message, onOpenHealth = { onOpenWeb("dashboard", "data-health") })
            }
            is NativeLoadState.Empty -> item { NoCompanyCard { onOpenWeb("dashboard", "manage-companies") } }
            is NativeLoadState.Invalid -> item {
                NativeErrorCard(loadState.message, { onOpenWeb("companies", null) }, "前往公司管理")
            }
            is NativeLoadState.Ready -> {
                val snapshot = loadState.snapshot
                if (activeDraft != null) {
                    if (preparing) item { PayrollLoadingCard("正在套用公司與計薪區間…") }
                    screenError?.let { message -> item { FormError(message) } }
                    item {
                        key(draftRevision) {
                            SalaryEditor(
                                draft = activeDraft!!,
                                snapshot = snapshot,
                                preparing = preparing,
                                onRebase = { companyId, year, month -> prepare(companyId, year, month) },
                                onSave = onSave,
                                onDirtyChanged = ::setDraftDirty,
                                onCancel = { activeDraft = null; setDraftDirty(false); screenError = null },
                                onOpenAdvanced = {
                                    activeDraft = null
                                    setDraftDirty(false)
                                    onOpenWeb("records", null)
                                },
                                onSaved = { message ->
                                    activeDraft = null
                                    setDraftDirty(false)
                                    onSaved(message)
                                }
                            )
                        }
                    }
                } else {
                    item {
                        PayrollActionCard(
                            recordCount = snapshot.salaryRecords.size,
                            busy = preparing,
                            onCreate = {
                                val today = NativePayrollMath.parseIsoDate(NativePayrollMath.todayIso())
                                prepare(
                                    snapshot.currentCompany?.id,
                                    today?.first ?: Calendar.getInstance().get(Calendar.YEAR),
                                    today?.second ?: 1
                                )
                            },
                            onOpenAdvanced = { onOpenWeb("records", null) }
                        )
                    }
                    screenError?.let { message -> item { FormError(message) } }
                    if (snapshot.salaryRecords.isEmpty()) {
                        item { EmptyPayrollCard() }
                    } else {
                        item { SectionHeader("最近薪資", "由新到舊排列；編輯與刪除都會建立新的保護快照。") }
                        items(snapshot.salaryRecords.size, key = { snapshot.salaryRecords[it].id }) { index ->
                            val record = snapshot.salaryRecords[index]
                            SalaryRecordCard(
                                record = record,
                                company = snapshot.companies.firstOrNull { it.id == record.companyId },
                                busy = preparing || deleting,
                                onEdit = { prepare(record.companyId, record.year, record.month, recordId = record.id) },
                                onCopy = { prepare(record.companyId, record.year, record.month, copyFromId = record.id) },
                                onDelete = { pendingDelete = record }
                            )
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(4.dp)) }
    }

    if (pendingDraftDiscard && activeDraft != null) {
        AlertDialog(
            onDismissRequest = { pendingDraftDiscard = false },
            title = { Text("放棄未儲存薪資草稿？") },
            text = { Text("返回後這次尚未建立／儲存的內容會被捨棄，已儲存資料不受影響。") },
            confirmButton = {
                TextButton(onClick = { activeDraft = null; setDraftDirty(false); screenError = null; pendingDraftDiscard = false }) { Text("放棄變更") }
            },
            dismissButton = { TextButton(onClick = { pendingDraftDiscard = false }) { Text("繼續編輯") } }
        )
    }

    pendingDelete?.let { record ->
        val companyName = (loadState as? NativeLoadState.Ready)?.snapshot?.companies
            ?.firstOrNull { it.id == record.companyId }?.name ?: "此公司"
        AlertDialog(
            onDismissRequest = { if (!deleting) pendingDelete = null },
            title = { Text("刪除薪資紀錄？") },
            text = {
                Text("將刪除 $companyName 的 ${record.year} 年 ${record.month} 月薪資。其他公司、加班與請假資料不會受影響。")
            },
            confirmButton = {
                TextButton(
                    enabled = !deleting,
                    onClick = {
                        deleting = true
                        scope.launch {
                            val result = runCatching { onDelete(record.id) }
                                .getOrElse { NativeSaveResult.Rejected("刪除失敗，資料未變更。") }
                            deleting = false
                            pendingDelete = null
                            when (result) {
                                is NativeSaveResult.Saved -> onSaved(result.message)
                                is NativeSaveResult.Rejected -> screenError = result.message
                                is NativeSaveResult.NeedsConfirmation -> screenError = result.warnings.joinToString("；")
                            }
                        }
                    }
                ) { Text(if (deleting) "正在刪除…" else "確認刪除") }
            },
            dismissButton = {
                TextButton(enabled = !deleting, onClick = { pendingDelete = null }) { Text("取消") }
            }
        )
    }
}

@Composable
private fun SalaryEditor(
    draft: NativeSalaryDraft,
    snapshot: NativeSnapshot,
    preparing: Boolean,
    onRebase: (String, Int, Int) -> Unit,
    onSave: suspend (NativeSalaryDraft) -> NativeSaveResult,
    onDirtyChanged: (Boolean) -> Unit,
    onCancel: () -> Unit,
    onOpenAdvanced: () -> Unit,
    onSaved: (String) -> Unit
) {
    var payDate by rememberSaveable { mutableStateOf(draft.payDate) }
    var baseSalaryText by rememberSaveable { mutableStateOf(draft.baseSalary.salaryInput()) }
    var baseHourlyRateText by rememberSaveable { mutableStateOf(draft.baseHourlyRate.salaryInput()) }
    var regularHoursText by rememberSaveable { mutableStateOf(draft.regularHours.salaryInput()) }
    var mealAllowanceText by rememberSaveable { mutableStateOf(draft.mealAllowance.salaryInput()) }
    var positionAllowanceText by rememberSaveable { mutableStateOf(draft.positionAllowance.salaryInput()) }
    var overtimeText by rememberSaveable { mutableStateOf(draft.overtime.salaryInput()) }
    var bonusText by rememberSaveable { mutableStateOf(draft.bonus.salaryInput()) }
    var laborInsText by rememberSaveable { mutableStateOf(draft.laborIns.salaryInput()) }
    var healthInsText by rememberSaveable { mutableStateOf(draft.healthIns.salaryInput()) }
    var taxText by rememberSaveable { mutableStateOf(draft.taxWithheld.salaryInput()) }
    var otherDeductionText by rememberSaveable { mutableStateOf(draft.otherDeduction.salaryInput()) }
    var pensionSelfText by rememberSaveable { mutableStateOf(draft.pensionSelf.salaryInput()) }
    var sideIncomeText by rememberSaveable { mutableStateOf(draft.sideIncome.salaryInput()) }
    var note by rememberSaveable { mutableStateOf(draft.note) }
    var autoTax by rememberSaveable { mutableStateOf(draft.autoTax) }
    var step by rememberSaveable(draft.id, draft.companyId, draft.year, draft.month) {
        mutableIntStateOf(if (draft.id.isBlank()) 1 else 2)
    }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val editing = draft.id.isNotBlank()
    val company = snapshot.companies.firstOrNull { it.id == draft.companyId }
    val calculatedBase = if (draft.employmentMode == "dispatch_hourly") {
        (baseHourlyRateText.decimalOrZero() * regularHoursText.decimalOrZero()).roundToLong().toDouble()
    } else {
        baseSalaryText.decimalOrZero()
    }

    fun currentDraft(tax: Double): NativeSalaryDraft = draft.copy(
        payDate = payDate,
        baseHourlyRate = baseHourlyRateText.decimalOrZero(),
        regularHours = regularHoursText.decimalOrZero(),
        baseSalary = calculatedBase,
        mealAllowance = mealAllowanceText.decimalOrZero(),
        positionAllowance = positionAllowanceText.decimalOrZero(),
        overtime = overtimeText.decimalOrZero(),
        bonus = bonusText.decimalOrZero(),
        laborIns = laborInsText.decimalOrZero(),
        healthIns = healthInsText.decimalOrZero(),
        taxWithheld = tax,
        otherDeduction = otherDeductionText.decimalOrZero(),
        pensionSelf = pensionSelfText.decimalOrZero(),
        sideIncome = sideIncomeText.decimalOrZero(),
        note = note,
        autoTax = autoTax
    )

    val beforeTax = currentDraft(0.0)
    val automaticTax = NativePayrollMath.salaryTax(NativePayrollMath.salaryTotals(beforeTax).gross).toDouble()
    val liveDraft = currentDraft(if (autoTax) automaticTax else taxText.decimalOrZero())
    val totals = NativePayrollMath.salaryTotals(liveDraft)
    val isDirty = liveDraft != draft
    LaunchedEffect(isDirty) { onDirtyChanged(isDirty) }

    fun validationMessage(includeMonthlyData: Boolean): String? {
        if (company == null) return "目前公司資料需要確認。請回公司管理重新選擇目前公司。"
        if (!Regex("\\d{4}-\\d{2}-\\d{2}").matches(payDate)) return "入帳日期格式不正確，請重新選擇日期。"
        if (includeMonthlyData && draft.employmentMode == "dispatch_hourly" && baseHourlyRateText.decimalOrZero() <= 0.0) return "基本時薪必須大於 0。"
        if (includeMonthlyData && draft.employmentMode == "dispatch_hourly" && regularHoursText.decimalOrZero() <= 0.0) return "本月正常工時必須大於 0。"
        return null
    }

    fun saveNow() {
        if (saving || preparing) return
        validationMessage(includeMonthlyData = true)?.let { message -> error = message; return }
        if (!editing && snapshot.currentCompanyId != liveDraft.companyId) {
            error = "目前公司已變更，薪資尚未建立。請取消後重新開始。"
            return
        }
        saving = true
        error = null
        scope.launch {
            val result = runCatching { onSave(liveDraft) }
                .getOrElse { NativeSaveResult.Rejected("儲存失敗，資料未變更。") }
            saving = false
            when (result) {
                is NativeSaveResult.Saved -> onSaved(result.message)
                is NativeSaveResult.Rejected -> error = result.message
                is NativeSaveResult.NeedsConfirmation -> error = result.warnings.joinToString("；")
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (!editing) {
            PayrollIdentityBox(
                "第 $step 步，共 3 步｜${listOf("月份", "本月資料", "確認")[step - 1]}",
                "建立流程綁定目前公司；切換公司前必須先取消這份草稿。"
            )
        }

        if (editing || step == 1) {
            FormCard {
                SectionHeader(
                    if (editing) "${draft.year} 年 ${draft.month} 月" else "1｜月份",
                    if (editing) "公司與歸屬年月鎖定，避免誤改歷史索引。" else "選擇月份並核對計薪區間；公司固定為目前公司。"
                )
                PayrollIdentityBox(
                    title = company?.name ?: "目前公司未設定",
                    detail = if (editing) "${draft.year} 年 ${draft.month} 月｜${draft.salaryPeriodLabel}" else "目前公司｜${draft.salaryPeriodLabel}"
                )
                if (!editing) {
                    val currentYear = NativePayrollMath.parseIsoDate(NativePayrollMath.todayIso())?.first ?: draft.year
                    val years = ((currentYear - 5)..(currentYear + 1)).toMutableSet().apply { add(draft.year) }.sortedDescending()
                    SelectionField(
                        label = "歸屬年份",
                        selectedLabel = "${draft.year} 年",
                        options = years.map { it.toString() to "$it 年" },
                        onSelected = { onRebase(draft.companyId, it.toInt(), draft.month) }
                    )
                    SelectionField(
                        label = "歸屬月份",
                        selectedLabel = "${draft.month} 月",
                        options = (1..12).map { it.toString() to "$it 月" },
                        onSelected = { onRebase(draft.companyId, draft.year, it.toInt()) }
                    )
                }
                DateSelectionField("入帳日期", payDate) { payDate = it; error = null }
                Text(
                    "預設為次月 5 日；遇週六、週日會提前。國定假日仍請依公司公告確認。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (!editing && step == 1) {
                error?.let { FormError(it) }
                Button(
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    enabled = !preparing,
                    shape = RoundedCornerShape(17.dp),
                    onClick = {
                        val message = validationMessage(includeMonthlyData = false)
                        if (message != null) error = message else { step = 2; error = null }
                    }
                ) { Text("下一步") }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = onCancel) { Text("取消") }
                return@Column
            }
        }

        if (editing || step == 2) {
            if (!editing) PayrollIdentityBox("2｜本月資料", "固定薪資已由公司規則帶入；此頁只調整本月交易。")
            FormCard {
                SectionHeader("應發薪資", if (draft.employmentMode == "dispatch_hourly") "派遣時薪 × 本月正常工時" else "月薪制固定薪資與本期變動項目")
                if (draft.employmentMode == "dispatch_hourly") {
                    SalaryMoneyField("基本時薪", baseHourlyRateText, { baseHourlyRateText = it }, suffix = "／時")
                    SalaryMoneyField("本月正常工時", regularHoursText, { regularHoursText = it }, prefix = "", suffix = " 小時")
                    PayrollIdentityBox("換算底薪", money(calculatedBase.roundToLong()))
                } else {
                    SalaryMoneyField("底薪／本薪", baseSalaryText, { baseSalaryText = it })
                }
                SalaryMoneyField("伙食津貼", mealAllowanceText, { mealAllowanceText = it })
                SalaryMoneyField("職務加給", positionAllowanceText, { positionAllowanceText = it })
                SalaryMoneyField("本期加班費", overtimeText, { overtimeText = it })
                Text(
                    "已由 ${draft.overtimeLogCount} 筆加班彙總；編輯歷史薪資時保留原快照金額。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                SalaryMoneyField("獎金／紅利", bonusText, { bonusText = it })
                if (draft.customEarnings.isNotEmpty()) MoneyItemsSummary("固定／自訂加項", draft.customEarnings)
            }

            FormCard {
                SectionHeader("扣除與其他收入", "自動預扣規則只作用在這次儲存的薪資快照。")
                SalaryMoneyField("勞保自負額", laborInsText, { laborInsText = it })
                SalaryMoneyField("健保自負額", healthInsText, { healthInsText = it })
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("自動預扣所得稅", style = MaterialTheme.typography.titleMedium)
                        Text("應發超過 NT$ 86,001 時按 5% 計算", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = autoTax, onCheckedChange = { autoTax = it; error = null })
                }
                if (autoTax) PayrollIdentityBox("本月預扣", money(automaticTax.roundToLong()))
                else SalaryMoneyField("手動預扣所得稅", taxText, { taxText = it })
                SalaryMoneyField("其他預設扣除", otherDeductionText, { otherDeductionText = it })
                if (draft.customDeductions.isNotEmpty()) MoneyItemsSummary("自訂扣項", draft.customDeductions)
                SalaryMoneyField("勞退個人自提", pensionSelfText, { pensionSelfText = it })
                SalaryMoneyField("副業／其他收入", sideIncomeText, { sideIncomeText = it })
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = note,
                    onValueChange = { if (it.length <= 300) note = it; error = null },
                    label = { Text("備註（選填）") },
                    minLines = 2,
                    maxLines = 4
                )
                TextButton(modifier = Modifier.fillMaxWidth(), onClick = onOpenAdvanced) { Text("捨棄本頁草稿，改用完整薪資紀錄") }
            }

            SalaryTotalsCard(totals.gross, totals.deductions, totals.pensionSelf, totals.combinedNet)
            error?.let { FormError(it) }
            if (editing) {
                Button(
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    enabled = !saving && !preparing,
                    shape = RoundedCornerShape(17.dp),
                    onClick = ::saveNow
                ) { Text(if (saving) "正在安全儲存…" else "儲存薪資變更") }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), enabled = !saving, onClick = onCancel) { Text("取消並返回紀錄") }
            } else {
                Button(
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    enabled = !preparing,
                    shape = RoundedCornerShape(17.dp),
                    onClick = {
                        val message = validationMessage(includeMonthlyData = true)
                        if (message != null) error = message else { step = 3; error = null }
                    }
                ) { Text("下一步") }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { step = 1 }) { Text("返回") }
            }
            if (editing) return@Column
        }

        if (!editing && step == 3) {
            PayrollIdentityBox("3｜確認", "建立前再次核對公司、月份與完整薪資拆解。")
            FormCard {
                SectionHeader("${company?.name ?: "目前公司未設定"}｜${draft.year} 年 ${draft.month} 月", draft.salaryPeriodLabel)
                PayrollSummaryRow("基本薪資", money(liveDraft.baseSalary.roundToLong()))
                PayrollSummaryRow("固定收入", money((liveDraft.mealAllowance + liveDraft.positionAllowance + liveDraft.customEarnings.filter { it.sourceType == "company-fixed" }.sumOf { it.amount }).roundToLong()))
                PayrollSummaryRow("加班", money(liveDraft.overtime.roundToLong()))
                PayrollSummaryRow("獎金", money(liveDraft.bonus.roundToLong()))
                PayrollSummaryRow("其他本月加項", money(liveDraft.customEarnings.filter { it.sourceType != "company-fixed" }.sumOf { it.amount }.roundToLong()))
                HorizontalDivider()
                PayrollSummaryRow("應發", money(totals.gross))
                PayrollSummaryRow("代扣", "−${money(totals.deductions)}")
                PayrollSummaryRow("勞退自提", "−${money(totals.pensionSelf)}")
                PayrollSummaryRow("實際入帳（含副業）", money(totals.combinedNet), emphasized = true)
            }
            Text("建立後會成為獨立薪資快照；後續公司規則修改不回寫此筆。", color = MaterialTheme.colorScheme.onSurfaceVariant)
            error?.let { FormError(it) }
            Button(
                modifier = Modifier.fillMaxWidth().height(54.dp),
                enabled = !saving && !preparing,
                shape = RoundedCornerShape(17.dp),
                onClick = ::saveNow
            ) {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.size(10.dp))
                    Text("正在安全建立…")
                } else Text("建立薪資")
            }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), enabled = !saving, onClick = { step = 2 }) { Text("返回修改") }
        }
    }
}

@Composable
private fun PayrollActionCard(
    recordCount: Int,
    busy: Boolean,
    onCreate: () -> Unit,
    onOpenAdvanced: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("原生月薪工作台", style = MaterialTheme.typography.titleLarge)
            Text("共 $recordCount 筆薪資；新建時會帶入公司薪資、該期加班與預扣規則。")
            Button(modifier = Modifier.fillMaxWidth(), enabled = !busy, onClick = onCreate) {
                Text(if (busy) "正在準備…" else "＋ 建立月度薪資")
            }
            TextButton(modifier = Modifier.fillMaxWidth(), onClick = onOpenAdvanced) { Text("開啟完整薪資分析") }
        }
    }
}

@Composable
private fun SalaryRecordCard(
    record: NativeSalaryRecord,
    company: NativeCompany?,
    busy: Boolean,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit
) {
    val totals = NativePayrollMath.salaryTotals(record)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("${record.year} 年 ${record.month} 月", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "${company?.name ?: "未知公司"}｜${record.payDate.ifBlank { "未填入帳日" }}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                    Text(
                        if (record.employmentMode == "dispatch_hourly") "派遣" else "月薪",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
            HorizontalDivider()
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PayrollMetric("應發", money(totals.gross), Modifier.weight(1f))
                PayrollMetric("實際入帳", money(totals.combinedNet), Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(modifier = Modifier.weight(1f), enabled = !busy, onClick = onEdit) { Text("編輯") }
                OutlinedButton(modifier = Modifier.weight(1f), enabled = !busy, onClick = onCopy) { Text("複製下一月") }
            }
            TextButton(modifier = Modifier.fillMaxWidth(), enabled = !busy, onClick = onDelete) { Text("刪除這筆薪資") }
        }
    }
}

@Composable
private fun SalaryTotalsCard(gross: Long, deductions: Long, pensionSelf: Long, combinedNet: Long) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(23.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("儲存前核對", style = MaterialTheme.typography.titleLarge)
            PayrollSummaryRow("應發薪資", money(gross))
            PayrollSummaryRow("代扣合計", "−${money(deductions)}")
            PayrollSummaryRow("勞退自提", "−${money(pensionSelf)}")
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.25f))
            PayrollSummaryRow("實際入帳（含副業）", money(combinedNet), emphasized = true)
        }
    }
}

@Composable
private fun SalaryMoneyField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    prefix: String = "NT$ ",
    suffix: String = ""
) {
    OutlinedTextField(
        modifier = Modifier.fillMaxWidth(),
        value = value,
        onValueChange = { onValueChange(it.filterDecimal(12)) },
        label = { Text(label) },
        prefix = { if (prefix.isNotBlank()) Text(prefix) },
        suffix = { if (suffix.isNotBlank()) Text(suffix) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
}

@Composable
private fun MoneyItemsSummary(title: String, items: List<NativeMoneyItem>) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.secondaryContainer
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            items.forEach { item -> PayrollSummaryRow(item.name.ifBlank { "未命名項目" }, money(item.amount.roundToLong())) }
        }
    }
}

@Composable
internal fun PayrollIdentityBox(title: String, detail: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(15.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PayrollMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PayrollSummaryRow(label: String, value: String, emphasized: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = if (emphasized) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium)
        Text(
            value,
            style = if (emphasized) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.SemiBold
        )
    }
}

@Composable
private fun PayrollLoadingCard(message: String) {
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
            Text(message, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun EmptyPayrollCard() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("尚未建立薪資紀錄", style = MaterialTheme.typography.titleLarge)
            Text("點選上方按鈕建立第一筆；系統不會放入示範資料。", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun Double.salaryInput(): String = cleanNumber()
