package com.salarymate.personal.backup

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import com.salarymate.personal.data.NATIVE_APP_VERSION
import com.salarymate.personal.data.NativeSalaryMateRepository
import com.salarymate.personal.data.NativeSaveResult
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

data class PreparedNativeBackup(
    val fileName: String,
    val encryptedText: String
)

data class NativeRestoreCandidate(
    val payload: String,
    val summary: String
)

class NativeBackupService(
    context: Context,
    private val repository: NativeSalaryMateRepository
) {
    private val appContext = context.applicationContext

    suspend fun prepareEncryptedBackup(password: String): PreparedNativeBackup {
        val payload = repository.exportSnapshotPayload()
        val encrypted = withContext(Dispatchers.Default) {
            NativeBackupCrypto.encrypt(payload, password).also { candidate ->
                if (NativeBackupCrypto.decrypt(candidate, password) != payload) {
                    throw NativeBackupCryptoException("VERIFY_FAILED", "備份解密驗證失敗")
                }
            }
        }
        return PreparedNativeBackup(fileName(), encrypted)
    }

    suspend fun preparePlainBackup(): PreparedNativeBackup {
        val payload = repository.exportSnapshotPayload()
        snapshotSummary(payload)
        return PreparedNativeBackup(fileName(), payload)
    }

    fun requiresPassword(text: String): Boolean =
        try { JSONObject(text).optString("format") == "salarymate-encrypted-backup" }
        catch (_: Exception) { false }

    suspend fun prepareRestoreCandidate(text: String, password: String): NativeRestoreCandidate =
        withContext(Dispatchers.Default) {
            val payload = if (requiresPassword(text)) NativeBackupCrypto.decrypt(text, password) else text
            NativeRestoreCandidate(payload, snapshotSummary(payload))
        }

    suspend fun applyRestoreCandidate(candidate: NativeRestoreCandidate): NativeSaveResult {
        return repository.restoreSnapshotPayload(candidate.payload)
    }

    suspend fun writeDocumentAndVerify(uri: Uri, encryptedText: String): String = withContext(Dispatchers.IO) {
        val expected = encryptedText.toByteArray(Charsets.UTF_8)
        appContext.contentResolver.openOutputStream(uri, "wt")?.use { output ->
            output.write(expected)
            output.flush()
        } ?: throw NativeBackupCryptoException("SAVE_UNAVAILABLE", "無法開啟選擇的儲存位置")
        val actual = readDocumentBytes(uri, NativeBackupCrypto.MAX_CIPHERTEXT_BYTES + 1_048_576)
        if (!MessageDigest.isEqual(sha256(expected), sha256(actual))) {
            throw NativeBackupCryptoException("VERIFY_FAILED", "備份寫入驗證失敗")
        }
        val savedName = documentDisplayName(uri)
            ?: throw NativeBackupCryptoException("SAVE_EXTENSION_CHANGED", "無法確認儲存後的備份檔名")
        if (!savedName.lowercase(Locale.ROOT).endsWith(".salarymate")) {
            throw NativeBackupCryptoException("SAVE_EXTENSION_CHANGED", "儲存位置未保留 .salarymate 副檔名")
        }
        savedName
    }

    suspend fun readDocument(uri: Uri): String = withContext(Dispatchers.IO) {
        val bytes = readDocumentBytes(uri, MAX_IMPORT_BYTES)
        try {
            Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
        } catch (error: Exception) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "備份檔案不是有效的文字格式", error)
        }
    }

    suspend fun createShareIntent(prepared: PreparedNativeBackup): Intent = withContext(Dispatchers.IO) {
        val directory = File(appContext.cacheDir, "salarymate-encrypted-backups").apply { mkdirs() }
        val file = File(directory, prepared.fileName)
        val bytes = prepared.encryptedText.toByteArray(Charsets.UTF_8)
        file.writeBytes(bytes)
        if (!MessageDigest.isEqual(sha256(bytes), sha256(file.readBytes()))) {
            throw NativeBackupCryptoException("VERIFY_FAILED", "分享前的備份寫入驗證失敗")
        }
        val uri = FileProvider.getUriForFile(
            appContext,
            "${appContext.packageName}.fileprovider",
            file
        )
        Intent(Intent.ACTION_SEND).apply {
            type = "application/octet-stream"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, prepared.fileName)
            clipData = ClipData.newRawUri(prepared.fileName, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun readDocumentBytes(uri: Uri, maximumBytes: Int): ByteArray {
        val output = ByteArrayOutputStream()
        appContext.contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > maximumBytes) {
                    throw NativeBackupCryptoException("PAYLOAD_TOO_LARGE", "備份檔案超過 30 MB 上限")
                }
                output.write(buffer, 0, count)
            }
        } ?: throw NativeBackupCryptoException("READ_FAILED", "無法讀取選擇的備份檔案")
        return output.toByteArray()
    }

    private fun fileName(): String {
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        return "SalaryMate_v${NATIVE_APP_VERSION}_${date}.salarymate"
    }

    private fun snapshotSummary(payload: String): String {
        val root = try {
            JSONObject(payload)
        } catch (error: Exception) {
            throw NativeBackupCryptoException("INVALID_SNAPSHOT", "解密內容不是有效的薪資資料", error)
        }
        val schemaValue = root.opt("schemaVersion")
        if (schemaValue !is Number || schemaValue.toDouble() != 13.0) {
            throw NativeBackupCryptoException(
                "UNSUPPORTED_SCHEMA",
                "這份備份不是 Schema 13；請使用完整管理介面先完成安全遷移"
            )
        }
        val required = listOf("companies", "records", "overtimeLogs")
        if (required.any { root.opt(it) !is JSONArray }) {
            throw NativeBackupCryptoException("INVALID_SNAPSHOT", "備份缺少公司、薪資或加班資料")
        }
        for (field in listOf("leaveRecords", "salaryAdjustments", "yearEndEstimates")) {
            if (root.has(field) && root.opt(field) !is JSONArray) {
                throw NativeBackupCryptoException("INVALID_SNAPSHOT", "備份欄位 $field 格式錯誤")
            }
        }
        return "公司 ${root.getJSONArray("companies").length()}｜薪資 ${root.getJSONArray("records").length()}｜加班 ${root.getJSONArray("overtimeLogs").length()}｜請假 ${root.optJSONArray("leaveRecords")?.length() ?: 0}"
    }

    private fun documentDisplayName(uri: Uri): String? = appContext.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null
    )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index < 0) null else cursor.getString(index)
    }

    private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    companion object {
        const val MAX_IMPORT_BYTES = 30 * 1024 * 1024
    }
}
