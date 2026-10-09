package com.salarymate.personal.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.salarymate.personal.data.ActivityKind
import com.salarymate.personal.data.NATIVE_APP_VERSION
import com.salarymate.personal.data.NativeActivityItem
import com.salarymate.personal.data.NativeLoadState
import com.salarymate.personal.data.NativeSnapshot
import java.text.DecimalFormat

@Composable
internal fun NativeHomeScreen(
    innerPadding: PaddingValues,
    loadState: NativeLoadState,
    onRefresh: () -> Unit,
    onOpenPayroll: () -> Unit,
    onOpenWeb: (String?, String?) -> Unit
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
                title = "今天想先處理什麼？",
                subtitle = "首頁已直接讀取同一份本機薪資快照，常用操作不用先進入完整介面。",
                trailing = {
                    OutlinedButton(onClick = onRefresh, contentPadding = PaddingValues(horizontal = 13.dp)) {
                        Text("更新")
                    }
                }
            )
        }
        when (loadState) {
            NativeLoadState.Loading -> item { LoadingCard() }
            is NativeLoadState.Failed -> item {
                NativeErrorCard(
                    message = loadState.message,
                    onOpenHealth = { onOpenWeb("dashboard", "data-health") },
                    onRetry = onRefresh
                )
            }
            is NativeLoadState.Empty -> item { FirstRunCard { onOpenWeb("dashboard", "manage-companies") } }
            is NativeLoadState.Invalid -> item {
                NativeErrorCard(
                    message = loadState.message,
                    onOpenHealth = { onOpenWeb("companies", null) },
                    actionLabel = "前往公司管理"
                )
            }
            is NativeLoadState.Ready -> {
                val snapshot = loadState.snapshot
                run {
                    item { SalaryHero(snapshot) }
                    item { TodayStatusCard(snapshot) }
                    item { SectionHeader("常用功能", "從薪資或工時／出勤查看並管理資料。") }
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            HomeActionCard(
                                modifier = Modifier.weight(1f),
                                title = "新增薪資",
                                description = "原生月薪表單",
                                badge = "薪",
                                tint = SalaryOrange,
                                onClick = onOpenPayroll
                            )
                            HomeActionCard(
                                modifier = Modifier.weight(1f),
                                title = "收入總覽",
                                description = "完整年度分析",
                                badge = "覽",
                                tint = SalaryRose,
                                onClick = { onOpenWeb("dashboard", null) }
                            )
                        }
                    }
                    item { SectionHeader("本期摘要", "${snapshot.overview.salaryMonthLabel}｜${snapshot.overview.currentCompanyName}") }
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "本期加班",
                                value = "${decimal(snapshot.overview.overtimeHours)} h",
                                detail = money(snapshot.overview.overtimePay),
                                tint = SalaryBlue
                            )
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "本期請假",
                                value = "${snapshot.overview.activeLeaveCount} 筆",
                                detail = "未取消紀錄",
                                tint = SalaryTeal
                            )
                        }
                    }
                    item {
                        MetricCard(
                            modifier = Modifier.fillMaxWidth(),
                            label = "${snapshot.overview.year} 年累計實領",
                            value = money(snapshot.overview.yearNetPay),
                            detail = "應發 ${money(snapshot.overview.yearGrossPay)}",
                            tint = SalaryOrange,
                            horizontal = true
                        )
                    }
                    if (snapshot.overview.recentItems.isNotEmpty()) {
                        item { SectionHeader("最近紀錄", "薪資、加班與請假整合顯示。") }
                        item { RecentActivityCard(snapshot.overview.recentItems) }
                    }
                    item { DataSourceCard(snapshot) }
                    item {
                        Button(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            onClick = { onOpenWeb("dashboard", null) },
                            shape = RoundedCornerShape(17.dp)
                        ) {
                            Text("開啟完整薪資管理")
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun LoadingCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(22.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.5.dp)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("正在讀取本機薪資摘要", style = MaterialTheme.typography.titleMedium)
                Text("不連網、不搬移資料。", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun FirstRunCard(onCreateCompany: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("先建立第一家公司", style = MaterialTheme.typography.titleLarge)
            Text(
                "目前沒有可供快速登記使用的公司資料。系統不會自動加入示範資料。",
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Button(onClick = onCreateCompany) { Text("建立公司與薪資規則") }
        }
    }
}

@Composable
private fun SalaryHero(snapshot: NativeSnapshot) {
    val overview = snapshot.overview
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        overview.currentCompanyName,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.secondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        overview.latestSalaryMonth ?: "最新薪資尚未建立",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Text(
                        "本機資料",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
            Text(
                overview.latestNetPay?.let(::money) ?: "尚無薪資金額",
                style = MaterialTheme.typography.headlineMedium,
                color = if (overview.latestNetPay == null) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface
            )
            Text(
                if (overview.latestGrossPay == null) "建立每月薪資後，首頁會顯示最近實領與年度累計。"
                else "最近實領｜應發 ${money(overview.latestGrossPay)}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun TodayStatusCard(snapshot: NativeSnapshot) {
    val registered = snapshot.overview.todayRegistered
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (registered) MaterialTheme.colorScheme.secondaryContainer
            else MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier.padding(17.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            Surface(
                modifier = Modifier.size(42.dp),
                shape = RoundedCornerShape(13.dp),
                color = if (registered) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(if (registered) "✓" else "今", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(snapshot.overview.todayStatus, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (registered) "今日已有登記" else "可至工時／出勤查看資料",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun HomeActionCard(
    modifier: Modifier,
    title: String,
    description: String,
    badge: String,
    tint: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(142.dp)
            .semantics(mergeDescendants = true) { role = Role.Button }
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Surface(shape = RoundedCornerShape(12.dp), color = tint.copy(alpha = 0.12f)) {
                Text(
                    text = badge,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    color = tint,
                    fontWeight = FontWeight.Bold
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(
                    description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier,
    label: String,
    value: String,
    detail: String,
    tint: Color,
    horizontal: Boolean = false
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        if (horizontal) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(value, style = MaterialTheme.typography.titleLarge, color = tint)
            }
        } else {
            Column(
                modifier = Modifier.padding(17.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.titleLarge, color = tint)
                Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun RecentActivityCard(items: List<NativeActivityItem>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(horizontal = 17.dp, vertical = 6.dp)) {
            items.forEachIndexed { index, item ->
                RecentActivityRow(item)
                if (index < items.lastIndex) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                    ) {}
                }
            }
        }
    }
}

@Composable
private fun RecentActivityRow(item: NativeActivityItem) {
    val tint = when (item.kind) {
        ActivityKind.Salary -> SalaryOrange
        ActivityKind.Overtime -> SalaryBlue
        ActivityKind.Leave -> SalaryTeal
    }
    val badge = when (item.kind) {
        ActivityKind.Salary -> "薪"
        ActivityKind.Overtime -> "時"
        ActivityKind.Leave -> "假"
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Surface(
            modifier = Modifier.size(38.dp),
            shape = RoundedCornerShape(12.dp),
            color = tint.copy(alpha = 0.12f)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(badge, color = tint, fontWeight = FontWeight.Bold)
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(item.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.date, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(item.detail, style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

@Composable
private fun DataSourceCard(snapshot: NativeSnapshot) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Column(
            modifier = Modifier.padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("同一份 SQLite 快照", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Text(NATIVE_APP_VERSION, style = MaterialTheme.typography.labelLarge)
            }
            Text(
                "公司 ${snapshot.companyCount}｜薪資 ${snapshot.salaryRecordCount}｜加班 ${snapshot.overtimeRecordCount}｜請假 ${snapshot.leaveRecordCount}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Text(
                "原生首頁與 Web 完整功能共用 Schema 13，不建立第二套薪資資料。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

private fun decimal(value: Double): String = DecimalFormat("0.##").format(value)
