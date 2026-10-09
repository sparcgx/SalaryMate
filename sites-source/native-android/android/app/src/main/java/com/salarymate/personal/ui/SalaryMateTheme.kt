package com.salarymate.personal.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val SalaryBlue = Color(0xFF2563EB)
val SalaryTeal = Color(0xFF0F766E)
val SalaryOrange = Color(0xFFC65D08)
val SalaryRose = Color(0xFFBE123C)
val SalaryInk = Color(0xFF162337)
val SalaryMuted = Color(0xFF5D6B78)
val SalaryCanvas = Color(0xFFF7F9F8)

private val LightColors = lightColorScheme(
    primary = SalaryTeal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE6F7F3),
    onPrimaryContainer = Color(0xFF0B5D57),
    secondary = SalaryBlue,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDDF5F0),
    onSecondaryContainer = Color(0xFF084E49),
    tertiary = SalaryOrange,
    onTertiary = Color.White,
    background = SalaryCanvas,
    onBackground = SalaryInk,
    surface = Color.White,
    onSurface = SalaryInk,
    surfaceVariant = Color(0xFFF4F7F6),
    onSurfaceVariant = SalaryMuted,
    outline = Color(0xFFDCE5E3),
    error = SalaryRose
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA9C7FF),
    onPrimary = Color(0xFF002F69),
    primaryContainer = Color(0xFF154A99),
    onPrimaryContainer = Color(0xFFD7E4FF),
    secondary = Color(0xFF7DDBD1),
    onSecondary = Color(0xFF003733),
    secondaryContainer = Color(0xFF07504A),
    onSecondaryContainer = Color(0xFFAAF5EB),
    tertiary = Color(0xFFFFB77E),
    onTertiary = Color(0xFF502400),
    background = Color(0xFF10171D),
    onBackground = Color(0xFFE2E8ED),
    surface = Color(0xFF172127),
    onSurface = Color(0xFFE2E8ED),
    surfaceVariant = Color(0xFF263238),
    onSurfaceVariant = Color(0xFFBAC6CC),
    outline = Color(0xFF879399),
    error = Color(0xFFFFB1C2)
)

@Composable
fun SalaryMateTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = SalaryMateTypography,
        content = content
    )
}
