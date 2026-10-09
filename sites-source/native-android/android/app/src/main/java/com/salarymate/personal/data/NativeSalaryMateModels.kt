package com.salarymate.personal.data

const val NATIVE_APP_VERSION = "5.0.0-dev.2-R99"

data class NativeMoneyItem(
    val id: String,
    val name: String,
    val amount: Double,
    val affectsHourly: Boolean = false,
    val sourceType: String = "",
    val sourceKey: String = ""
)

data class NativeCompanyBasicsDraft(
    val id: String = "",
    val name: String,
    val baseSalary: Double,
    val employmentStartDate: String
)

data class NativeCompany(
    val id: String,
    val name: String,
    val position: String,
    val isCurrent: Boolean,
    val employmentMode: String,
    val baseSalary: Double,
    val baseHourlyRate: Double,
    val defaultRegularHours: Double,
    val mealAllowance: Double,
    val positionAllowance: Double,
    val fixedEarnings: List<NativeMoneyItem>,
    val laborIns: Double,
    val healthIns: Double,
    val taxWithheld: Double,
    val payrollPeriodType: String,
    val workHoursPerDay: Double,
    val employmentStartDate: String
)

data class NativeSalaryRecord(
    val id: String,
    val companyId: String,
    val year: Int,
    val month: Int,
    val payDate: String,
    val employmentMode: String,
    val baseHourlyRate: Double,
    val regularHours: Double,
    val baseSalary: Double,
    val mealAllowance: Double,
    val positionAllowance: Double,
    val overtime: Double,
    val bonus: Double,
    val customEarnings: List<NativeMoneyItem>,
    val laborIns: Double,
    val healthIns: Double,
    val taxWithheld: Double,
    val otherDeduction: Double,
    val customDeductions: List<NativeMoneyItem>,
    val pensionSelf: Double,
    val sideIncome: Double,
    val note: String
)

data class NativeSalaryDraft(
    val id: String,
    val companyId: String,
    val year: Int,
    val month: Int,
    val payDate: String,
    val employmentMode: String,
    val baseHourlyRate: Double,
    val regularHours: Double,
    val baseSalary: Double,
    val mealAllowance: Double,
    val positionAllowance: Double,
    val overtime: Double,
    val bonus: Double,
    val customEarnings: List<NativeMoneyItem>,
    val laborIns: Double,
    val healthIns: Double,
    val taxWithheld: Double,
    val otherDeduction: Double,
    val customDeductions: List<NativeMoneyItem>,
    val pensionSelf: Double,
    val sideIncome: Double,
    val note: String,
    val autoTax: Boolean,
    val overtimeLogCount: Int,
    val salaryPeriodLabel: String,
    val profileSourceLabel: String
)

sealed interface NativeSalaryDraftResult {
    data class Ready(val draft: NativeSalaryDraft) : NativeSalaryDraftResult
    data class Rejected(val message: String) : NativeSalaryDraftResult
}

data class NativeActivityItem(
    val kind: ActivityKind,
    val title: String,
    val detail: String,
    val date: String
)

enum class ActivityKind {
    Salary,
    Overtime,
    Leave
}

data class NativeHomeOverview(
    val currentCompanyName: String,
    val salaryMonthLabel: String,
    val latestSalaryMonth: String?,
    val latestNetPay: Long?,
    val latestGrossPay: Long?,
    val year: Int,
    val yearNetPay: Long,
    val yearGrossPay: Long,
    val overtimeHours: Double,
    val overtimePay: Long,
    val activeLeaveCount: Int,
    val todayRegistered: Boolean,
    val todayStatus: String,
    val recentItems: List<NativeActivityItem>
)

data class NativeSnapshot(
    val hasSnapshot: Boolean,
    val sourceAppVersion: String,
    val updatedAt: String,
    val companies: List<NativeCompany>,
    val salaryRecords: List<NativeSalaryRecord>,
    val currentCompanyId: String?,
    val latestOvertimeRate: Double,
    val companyCount: Int,
    val salaryRecordCount: Int,
    val overtimeRecordCount: Int,
    val leaveRecordCount: Int,
    val overview: NativeHomeOverview
) {
    val currentCompany: NativeCompany?
        get() = companies.firstOrNull { it.id == currentCompanyId }
            ?: companies.firstOrNull { it.isCurrent }
}

sealed interface NativeLoadState {
    data object Loading : NativeLoadState
    data class Empty(val snapshot: NativeSnapshot) : NativeLoadState
    data class Invalid(val snapshot: NativeSnapshot, val message: String) : NativeLoadState
    data class Ready(val snapshot: NativeSnapshot) : NativeLoadState
    data class Failed(val message: String) : NativeLoadState
}

enum class NativeOvertimeType(
    val storageValue: String,
    val label: String,
    val explanation: String
) {
    Weekday("weekday", "平日", "前 2 小時 1.34×，之後 1.67×"),
    RestDay("restday", "休息日", "1.34×／1.67×／2.67×"),
    Holiday("holiday", "星期天", "固定 2.0×"),
    SpringFestival("spring", "春節", "固定 2.5×"),
    Custom("custom", "自訂", "使用自訂固定倍率")
}

data class NativeOvertimeDraft(
    val date: String,
    val companyId: String,
    val type: NativeOvertimeType,
    val hours: Double,
    val hourlyRate: Double,
    val customRate: Double,
    val note: String
)

enum class NativeLeaveType(
    val storageValue: String,
    val label: String,
    val defaultPaidRatio: Int
) {
    Annual("annual", "特休", 100),
    Sick("sick", "普通病假", 50),
    Personal("personal", "事假", 0),
    Family("family", "家庭照顧假", 0),
    Compensatory("compensatory", "補休", 100),
    Marriage("marriage", "婚假", 100),
    Funeral("funeral", "喪假", 100),
    Menstrual("menstrual", "生理假", 50),
    Occupational("occupational", "公傷病假", 100),
    Public("public", "公假", 100),
    Other("other", "其他假別", 0)
}

enum class NativeLeaveDuration(
    val storageValue: String,
    val label: String
) {
    FullDay("full_day", "整天"),
    HalfMorning("half_am", "上午半天"),
    HalfAfternoon("half_pm", "下午半天"),
    Hours("hours", "按小時計")
}

enum class NativeLeaveStatus(
    val storageValue: String,
    val label: String
) {
    Planned("planned", "預計／待確認"),
    Confirmed("confirmed", "已確認")
}

data class NativeLeaveDraft(
    val date: String,
    val companyId: String,
    val type: NativeLeaveType,
    val duration: NativeLeaveDuration,
    val customHours: Double,
    val status: NativeLeaveStatus,
    val paidRatio: Int,
    val note: String
)

sealed interface NativeSaveResult {
    data class Saved(val message: String) : NativeSaveResult
    data class NeedsConfirmation(val warnings: List<String>) : NativeSaveResult
    data class Rejected(val message: String) : NativeSaveResult
}
