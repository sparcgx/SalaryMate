package com.salarymate.personal;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    private static final int MAX_BACKUP_BYTES = 30 * 1024 * 1024;
    private static final int MAX_DOCUMENT_BYTES = 45 * 1024 * 1024;
    private static final String MIME_TYPE = "application/octet-stream";
    private PluginCall documentCall;

    /** General R99 JSON/CSV/HTML export. The original .salarymate save contract remains below. */
    @PluginMethod
    public void saveDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (!isSafeDocumentName(fileName) || !isAllowedMime(mimeType, fileName)) {
            call.reject("檔名或檔案格式不正確", "SAVE_INVALID_DOCUMENT"); return;
        }
        try { decodeDocument(call); }
        catch (RuntimeException error) { call.reject("檔案內容為空、格式不正確或超過 45 MB", "SAVE_INVALID_DOCUMENT"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        launchDocumentPicker(call, intent, "documentSaveResult");
    }

    @ActivityCallback
    private void documentSaveResult(PluginCall call, ActivityResult result) {
        getBridge().execute(() -> {
            try { writeSelectedDocument(call, result); }
            finally { completeDocumentFlow(call); }
        });
    }

    private void writeSelectedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("已取消儲存；本機資料保持不變", "SAVE_CANCELLED"); return;
        }
        Uri uri = result.getData().getData();
        if (!isDocumentUri(uri)) { call.reject("儲存位置無效", "SAVE_FAILED"); return; }
        String savedName = queryDisplayName(uri), requestedName = call.getString("fileName");
        if (!isSafeDocumentName(savedName) || requestedName == null
            || !extension(savedName).equals(extension(requestedName))) {
            deleteIncomplete(uri);
            call.reject("儲存位置未保留原檔案副檔名", "SAVE_EXTENSION_CHANGED"); return;
        }
        try {
            byte[] expected = decodeDocument(call);
            writeAndVerify(uri, expected, MAX_DOCUMENT_BYTES);
            JSObject response = new JSObject(); response.put("fileName", savedName);
            response.put("size", expected.length); response.put("verified", true);
            call.resolve(response);
        } catch (Exception error) {
            deleteIncomplete(uri);
            call.reject("檔案未能完整寫入或讀回驗證；請重新選擇儲存位置", "SAVE_FAILED");
        }
    }

    /** Read the user's selected local or Drive-provider JSON without replacing local state. */
    @PluginMethod
    public void openDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/json", "application/octet-stream", "text/plain"
        });
        launchDocumentPicker(call, intent, "documentOpenResult");
    }

    @ActivityCallback
    private void documentOpenResult(PluginCall call, ActivityResult result) {
        getBridge().execute(() -> {
            try { readSelectedDocument(call, result); }
            finally { completeDocumentFlow(call); }
        });
    }

    private void readSelectedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("已取消匯入；本機資料保持不變", "OPEN_CANCELLED"); return;
        }
        Uri uri = result.getData().getData();
        if (!isDocumentUri(uri)) { call.reject("檔案位置無效", "OPEN_FAILED"); return; }
        String name = queryDisplayName(uri);
        if (!isSafeDocumentName(name) || !(extension(name).equals("json") || extension(name).equals("salarymate"))) {
            call.reject("請選擇 JSON 或 SalaryMate 備份檔", "OPEN_INVALID_DOCUMENT"); return;
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException("No input stream");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + (long) count > MAX_DOCUMENT_BYTES) throw new IOException("Document too large");
                output.write(buffer, 0, count);
            }
            byte[] bytes = output.toByteArray();
            String text = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
            JSObject response = new JSObject(); response.put("fileName", name);
            response.put("size", bytes.length); response.put("data", text); call.resolve(response);
        } catch (Exception error) {
            call.reject("備份無法讀取、編碼不正確或超過 45 MB；現有資料保持不變", "OPEN_FAILED");
        }
    }

    private void launchDocumentPicker(PluginCall call, Intent intent, String callback) {
        getActivity().runOnUiThread(() -> {
            if (documentCall != null) { call.reject("請等目前檔案操作完成", "DOCUMENT_BUSY"); return; }
            documentCall = call;
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).beginDocumentFlow();
            try { startActivityForResult(call, intent, callback); }
            catch (RuntimeException error) {
                completeDocumentFlow(call);
                call.reject("此裝置沒有可用的檔案選擇器", "PICKER_UNAVAILABLE");
            }
        });
    }

    private void completeDocumentFlow(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (documentCall == null || (call != null && documentCall != call)) return;
            documentCall = null;
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).endDocumentFlow();
        });
    }

    private byte[] decodeDocument(PluginCall call) {
        String data = call.getString("data"), encoding = call.getString("encoding", "utf8");
        if (data == null || data.isEmpty()) throw new IllegalArgumentException("Empty document");
        byte[] bytes;
        if ("base64".equals(encoding)) {
            if (data.length() > ((MAX_DOCUMENT_BYTES + 2L) / 3L) * 4L
                || data.length() % 4 != 0 || !data.matches("[A-Za-z0-9+/]*={0,2}")) {
                throw new IllegalArgumentException("Invalid base64");
            }
            bytes = Base64.decode(data, Base64.NO_WRAP);
        } else if ("utf8".equals(encoding)) {
            if (data.length() > MAX_DOCUMENT_BYTES) throw new IllegalArgumentException("Document too large");
            bytes = data.getBytes(StandardCharsets.UTF_8);
        } else throw new IllegalArgumentException("Invalid encoding");
        if (bytes.length == 0 || bytes.length > MAX_DOCUMENT_BYTES) throw new IllegalArgumentException("Document too large");
        return bytes;
    }

    private static boolean isDocumentUri(Uri uri) { return uri != null && "content".equals(uri.getScheme()); }
    private static String extension(String name) {
        if (name == null || !name.contains(".")) return "";
        return name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }
    private static boolean isSafeDocumentName(String name) {
        if (name == null || name.trim().isEmpty() || name.length() > 180 || name.contains("/") || name.contains("\\")) return false;
        for (int i = 0; i < name.length(); i++) if (Character.isISOControl(name.charAt(i))) return false;
        String suffix = extension(name);
        return suffix.equals("json") || suffix.equals("csv") || suffix.equals("html") || suffix.equals("salarymate");
    }
    private static boolean isAllowedMime(String mime, String name) {
        if (mime == null) return false;
        switch (extension(name)) {
            case "json": return mime.equals("application/json");
            case "csv": return mime.equals("text/csv");
            case "html": return mime.equals("text/html");
            case "salarymate": return mime.equals(MIME_TYPE);
            default: return false;
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String data = call.getString("data");
        if (!isSafeBackupName(fileName)) {
            call.reject("備份檔名必須以 .salarymate 結尾", "SAVE_EXTENSION_CHANGED");
            return;
        }
        if (data == null || data.isEmpty()) {
            call.reject("備份內容為空", "SAVE_FAILED");
            return;
        }
        if (data.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
            call.reject("備份超過 30 MB 上限", "SAVE_FAILED");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(MIME_TYPE);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        launchDocumentPicker(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        getBridge().execute(() -> {
            try { writeSelectedLegacyBackup(call, result); }
            finally { completeDocumentFlow(call); }
        });
    }

    private void writeSelectedLegacyBackup(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("使用者取消另存備份", "SAVE_CANCELLED");
            return;
        }

        Uri uri = result.getData().getData();
        if (!isDocumentUri(uri)) {
            call.reject("儲存位置無效", "SAVE_FAILED");
            return;
        }

        String savedName = queryDisplayName(uri);
        if (!isSafeBackupName(savedName)) {
            deleteIncomplete(uri);
            call.reject("儲存位置未保留 .salarymate 副檔名", "SAVE_EXTENSION_CHANGED");
            return;
        }

        String data = call.getString("data");
        if (data == null) {
            deleteIncomplete(uri);
            call.reject("備份內容遺失", "SAVE_FAILED");
            return;
        }

        byte[] expected = data.getBytes(StandardCharsets.UTF_8);
        try {
            writeAndVerify(uri, expected);
            JSObject response = new JSObject();
            response.put("fileName", savedName);
            call.resolve(response);
        } catch (Exception error) {
            deleteIncomplete(uri);
            call.reject("備份未能完整寫入或驗證", "SAVE_FAILED", error);
        }
    }

    private boolean isSafeBackupName(String fileName) {
        if (fileName == null || fileName.length() > 180 || fileName.contains("/") || fileName.contains("\\")) return false;
        return fileName.toLowerCase(Locale.ROOT).endsWith(".salarymate");
    }

    private String queryDisplayName(Uri uri) {
        ContentResolver resolver = getContext().getContentResolver();
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && !value.isEmpty()) return value;
                }
            }
        } catch (RuntimeException ignored) {
            // Fail closed below if a provider cannot report the actual saved filename.
        }
        return null;
    }

    private void writeAndVerify(Uri uri, byte[] expected) throws IOException, NoSuchAlgorithmException {
        writeAndVerify(uri, expected, MAX_BACKUP_BYTES);
    }

    private void writeAndVerify(Uri uri, byte[] expected, int byteLimit) throws IOException, NoSuchAlgorithmException {
        ContentResolver resolver = getContext().getContentResolver();
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            if (output == null) throw new IOException("No output stream");
            output.write(expected);
            output.flush();
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long actualLength = 0;
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) throw new IOException("No input stream");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                actualLength += count;
                if (actualLength > byteLimit) throw new IOException("Saved backup too large");
                digest.update(buffer, 0, count);
            }
        }

        byte[] expectedDigest = MessageDigest.getInstance("SHA-256").digest(expected);
        if (actualLength != expected.length || !MessageDigest.isEqual(expectedDigest, digest.digest())) {
            throw new IOException("Saved backup verification mismatch");
        }
    }

    private void deleteIncomplete(Uri uri) {
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
        } catch (Exception ignored) {
            // The provider may not support deletion; never hide the original save failure.
        }
    }
}
