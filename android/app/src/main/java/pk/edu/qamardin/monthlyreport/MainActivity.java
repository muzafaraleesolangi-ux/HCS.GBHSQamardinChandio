package pk.edu.qamardin.monthlyreport;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.OutputStream;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final int CREATE_DOCUMENT = 4001;
    private WebView webView;
    private ProgressBar progress;
    private byte[] pendingDocument;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF07543F);
        getWindow().setNavigationBarColor(0xFFF8FAF7);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        FrameLayout frame = new FrameLayout(this);
        webView = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 5);
        frame.addView(webView);
        frame.addView(progress, progressParams);
        setContentView(frame);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.addJavascriptInterface(new AppBridge(), "QamardinAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_HOST.equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "No browser found", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(ProgressBar.GONE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress == 100 ? ProgressBar.GONE : ProgressBar.VISIBLE);
            }
        });
        webView.loadUrl("https://" + APP_HOST + "/assets/www/monthly-progress.html");
    }

    private final class AppBridge {
        @JavascriptInterface
        public boolean saveFile(String filename, String encoded, String mime) {
            if (filename == null || !filename.toLowerCase().endsWith(".xlsx")
                || encoded == null || encoded.length() > 30_000_000) return false;
            byte[] bytes;
            try {
                bytes = Base64.decode(encoded, Base64.DEFAULT);
            } catch (IllegalArgumentException error) {
                return false;
            }
            final String safeName = filename.replaceAll("[\\/:*?\"<>|]", "_");
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                pendingDocument = bytes;
                runOnUiThread(() -> {
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                        .putExtra(Intent.EXTRA_TITLE, safeName);
                    startActivityForResult(create, CREATE_DOCUMENT);
                });
                return true;
            }
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IOException("Cannot open download");
                    output.write(bytes);
                } catch (IOException error) {
                    getContentResolver().delete(uri, null, null);
                    return false;
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(uri, values, null, null);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Excel saved to Downloads", Toast.LENGTH_LONG).show());
                return true;
            } catch (RuntimeException error) {
                return false;
            }
        }

        @JavascriptInterface
        public void printReport(String title) {
            runOnUiThread(() -> {
                PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                if (manager != null) manager.print(
                    title == null || title.isEmpty() ? "Qamardin Monthly Report" : title,
                    webView.createPrintDocumentAdapter(title), null);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CREATE_DOCUMENT) return;
        byte[] bytes = pendingDocument;
        pendingDocument = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
        try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
            if (output == null) throw new IOException("Cannot open document");
            output.write(bytes);
            Toast.makeText(this, "Excel saved", Toast.LENGTH_LONG).show();
        } catch (IOException error) {
            Toast.makeText(this, "Could not save Excel", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
