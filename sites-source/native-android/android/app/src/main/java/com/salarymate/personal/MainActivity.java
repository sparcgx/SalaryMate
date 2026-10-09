package com.salarymate.personal;

import android.content.Intent;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.io.ByteArrayInputStream;

import kotlin.Unit;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_TAB = "salarymate_tab";
    public static final String EXTRA_ACTION = "salarymate_action";

    private static final int ROUTE_RETRY_LIMIT = 16;
    private static final String APP_HOST = "salarymate.sparcgx2420.chatgpt.site";
    private static final Set<String> MARKET_PATHS = new HashSet<>(Arrays.asList(
        "/api/stocks/portable/quotes", "/api/stocks/portable/nav", "/api/stocks/portable/lookup",
        "/api/stocks/portable/dividends", "/api/stocks/portable/catalog"
    ));
    private static final Set<String> ALLOWED_TABS = new HashSet<>(Arrays.asList(
        "dashboard", "records", "overtime", "hourly", "tax", "companies"
    ));
    private static final Set<String> ALLOWED_ACTIONS = new HashSet<>(Arrays.asList(
        "add-record", "add-overtime", "add-leave", "manage-companies",
        "open-interface-settings", "data-health", "company-full-settings", "company-salary-rules", "company-advanced-rules"
    ));
    private NativeSecurityController security;
    private FrameLayout lockOverlay;
    private TextView lockMessage;
    private Button unlockButton;
    private boolean unlocked;
    private boolean authenticating;
    private boolean backPending;
    private int documentFlows;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceSecurityPlugin.class);
        registerPlugin(BackupFilePlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null || bridge.getWebView() == null) return;
        // Keep Capacitor's file chooser, injected bridge and local asset server.
        // Only the five explicit market endpoints may bypass local interception.
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isOwnOrigin(uri)) {
                    if (!request.isForMainFrame() && MARKET_PATHS.contains(uri.getEncodedPath())
                        && ("POST".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod()))) return null;
                    if (uri.getPath() != null && uri.getPath().startsWith("/api/")) return blockedResponse();
                    WebResourceResponse local = super.shouldInterceptRequest(view, request);
                    return local == null ? blockedResponse() : local;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && isAppDocument(request.getUrl())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
        });
        security = new NativeSecurityController(this);
        security.applyScreenProtection();
        unlocked = !security.isLockEnabled() || security.currentStatus().getUnlockedRecently();
        createLockOverlay();
        updateLockScreen();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { handleApplicationBack(); }
        });
        routeFromComposeShell(getIntent(), 0);
    }

    private static boolean isOwnOrigin(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }

    private static boolean isAppDocument(Uri uri) {
        return isOwnOrigin(uri) && ("/".equals(uri.getPath()) || "/index.html".equals(uri.getPath()));
    }

    private static WebResourceResponse blockedResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
            new ByteArrayInputStream(new byte[0]));
    }

    private void openExternal(Uri uri) {
        String scheme = uri == null ? "" : uri.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme) && !"mailto".equals(scheme)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (RuntimeException ignored) { /* No external handler: retain the private app page. */ }
    }

    private void createLockOverlay() {
        lockOverlay = new FrameLayout(this);
        lockOverlay.setBackgroundColor(Color.WHITE);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        TextView title = new TextView(this);
        title.setText("SalaryMate"); title.setTextSize(24); title.setTextColor(Color.rgb(15, 23, 42));
        content.addView(title);
        lockMessage = new TextView(this);
        lockMessage.setText("個人薪資與投資管理已鎖定。");
        lockMessage.setTextColor(Color.rgb(51, 65, 85));
        lockMessage.setGravity(Gravity.CENTER); lockMessage.setPadding(0, padding, 0, padding);
        content.addView(lockMessage);
        unlockButton = new Button(this); unlockButton.setText("解鎖");
        unlockButton.setOnClickListener(view -> requestUnlock()); content.addView(unlockButton);
        Button leave = new Button(this); leave.setText("返回");
        leave.setOnClickListener(view -> moveTaskToBack(true)); content.addView(leave);
        lockOverlay.addView(content, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        addContentView(lockOverlay, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void updateLockScreen() {
        if (lockOverlay == null || bridge == null) return;
        lockOverlay.setVisibility(unlocked ? View.GONE : View.VISIBLE);
        bridge.getWebView().setVisibility(unlocked ? View.VISIBLE : View.INVISIBLE);
        unlockButton.setEnabled(!authenticating);
    }

    private void requestUnlock() {
        if (security == null || unlocked || authenticating || isFinishing()) return;
        security.authenticate(busy -> {
            authenticating = busy; updateLockScreen(); return Unit.INSTANCE;
        }, () -> {
            unlocked = true; lockMessage.setText("個人薪資與投資管理已鎖定。");
            updateLockScreen(); return Unit.INSTANCE;
        }, message -> {
            lockMessage.setText(message); updateLockScreen(); return Unit.INSTANCE;
        }, "確認身分後開啟薪資與投資資料");
    }

    @Override public void onResume() {
        super.onResume();
        if (security == null) return;
        security.applyScreenProtection();
        if (!security.isLockEnabled()) unlocked = true;
        updateLockScreen();
        if (!unlocked && !authenticating) getWindow().getDecorView().post(this::requestUnlock);
    }

    @Override public void onStop() {
        if (security != null && security.isLockEnabled() && !isChangingConfigurations()
            && documentFlows == 0 && !authenticating) {
            unlocked = false; updateLockScreen();
        }
        super.onStop();
    }

    // Match the existing native shell: a user-selected system document flow
    // does not discard the current app session when its picker covers the app.
    void beginDocumentFlow() { runOnUiThread(() -> documentFlows++); }
    void endDocumentFlow() { runOnUiThread(() -> documentFlows = Math.max(0, documentFlows - 1)); }

    private void handleApplicationBack() {
        if (!unlocked) { moveTaskToBack(true); return; }
        if (backPending || bridge == null) return;
        String currentUrl = bridge.getWebView().getUrl();
        if (currentUrl == null || !isAppDocument(Uri.parse(currentUrl))) return;
        backPending = true;
        bridge.getWebView().evaluateJavascript("(function(){try{const app=window.SalaryMateData;"
            + "if(!app)return 'loading';if(app.handleBackButton())return 'handled';"
            + "if(app.operationalScope().draftScope?.dirty)return 'blocked';return 'exit';"
            + "}catch(error){return 'blocked';}})()", result -> {
                backPending = false;
                if (!"\"exit\"".equals(result) || isFinishing()) return;
                new AlertDialog.Builder(this).setTitle("離開 SalaryMate？")
                    .setMessage("本機已儲存的資料會保留。")
                    .setNegativeButton("取消", (dialog, which) -> dialog.dismiss())
                    .setPositiveButton("離開", (dialog, which) -> moveTaskToBack(true)).show();
            });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        routeFromComposeShell(intent, 0);
    }

    private void routeFromComposeShell(Intent intent, int attempt) {
        if (intent == null || bridge == null || bridge.getWebView() == null) return;

        String requestedTab = intent.getStringExtra(EXTRA_TAB);
        String requestedAction = intent.getStringExtra(EXTRA_ACTION);
        String tab = ALLOWED_TABS.contains(requestedTab) ? requestedTab : null;
        String action = ALLOWED_ACTIONS.contains(requestedAction) ? requestedAction : null;
        if (tab == null && action == null) return;

        WebView webView = bridge.getWebView();
        String tabJson = tab == null ? "null" : JSONObject.quote(tab);
        String actionJson = action == null ? "null" : JSONObject.quote(action);
        String script = "(function(){"
            + "const tab=" + tabJson + ";const action=" + actionJson + ";"
            + "const tabButton=tab?document.querySelector('[data-tab=\"'+tab+'\"]'):null;"
            + "if(tab&&!tabButton)return 'retry';"
            + "if(tabButton)tabButton.click();"
            + "const attendanceTab=action==='add-leave'?'leave':(action==='add-overtime'?'overtime':null);"
            + "const attendanceButton=attendanceTab?document.querySelector('[data-attendance-tab=\"'+attendanceTab+'\"]'):null;"
            + "if(attendanceTab&&!attendanceButton)return 'retry';"
            + "if(attendanceButton)attendanceButton.click();"
            + "const actionButton=action?document.querySelector('[data-action=\"'+action+'\"]'):null;"
            + "if(action&&!actionButton)return 'retry';"
            + "if(actionButton)actionButton.click();"
            + "return 'ok';"
            + "})()";

        webView.postDelayed(() -> webView.evaluateJavascript(script, result -> {
            if (!"\"ok\"".equals(result) && attempt < ROUTE_RETRY_LIMIT) {
                routeFromComposeShell(intent, attempt + 1);
            }
        }), attempt == 0 ? 250L : 180L);
    }
}
