package br.com.falasindico.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.http.SslError;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Activity Principal do App Android "Vida Moderna News" para TV Box Aquarius STV-Plus e Tablets.
 * - Compatível com versões antigas do Android e WebView (Android 4.4 / 5.1 / 6.0 / 7.1+).
 * - Suporte a certificados SSL modernos (Supabase / GitHub Pages / G1) mesmo em Android antigo.
 */
public class MainActivity extends Activity {

    private WebView webView;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback wifiCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile String discoveredServerUrl = "";
    private volatile boolean isScanningSubnet = false;

    private final BroadcastReceiver wifiStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            scanLocalWifiForServerAsync();
            triggerWebViewAutoSync();
        }
    };

    @SuppressLint({"CustomX509TrustManager", "TrustAllX509TrustManager", "BadHostnameVerifier"})
    private void enableLegacySslCompatibility() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {}

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {}

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true;
                }
            });
        } catch (Exception ignored) {}
    }

    public class AndroidNativeBridge {
        @JavascriptInterface
        public String getDiscoveredServerUrl() {
            return discoveredServerUrl;
        }

        @JavascriptInterface
        public String fetchUrl(String urlStr) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(7000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 VidaModernaNews-AquariusSTV/3.0");
                conn.setRequestProperty("Accept-Encoding", "gzip");

                int code = conn.getResponseCode();
                if (code >= 200 && code < 300) {
                    InputStream in = conn.getInputStream();
                    String encoding = conn.getContentEncoding();
                    if (encoding != null && encoding.toLowerCase().contains("gzip")) {
                        in = new GZIPInputStream(in);
                    }
                    BufferedReader reader = new BufferedReader(new InputStreamReader(in, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    reader.close();
                    return sb.toString();
                }
            } catch (Exception ignored) {
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
            return "";
        }

        @JavascriptInterface
        public String fetchSupabaseState(String endpointUrl, String anonKey) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(endpointUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(7000);
                conn.setRequestProperty("apikey", anonKey);
                if (anonKey != null && anonKey.startsWith("eyJ")) {
                    conn.setRequestProperty("Authorization", "Bearer " + anonKey);
                }
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Accept-Encoding", "gzip");

                int code = conn.getResponseCode();
                if (code >= 200 && code < 300) {
                    InputStream in = conn.getInputStream();
                    String encoding = conn.getContentEncoding();
                    if (encoding != null && encoding.toLowerCase().contains("gzip")) {
                        in = new GZIPInputStream(in);
                    }
                    BufferedReader reader = new BufferedReader(new InputStreamReader(in, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    reader.close();
                    return sb.toString();
                }
            } catch (Exception ignored) {
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
            return "";
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface", "WebViewClientOnReceivedSslError"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        enableLegacySslCompatibility();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enableImmersiveFullscreen();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new AndroidNativeBridge(), "AndroidNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Permite carregar imagens HTTPS e Supabase mesmo em Android antigo com certificados de fábrica antigos
                handler.proceed();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("file:///android_asset/public/index.html");

        registerWifiAutoSyncListeners();
        scanLocalWifiForServerAsync();
    }

    private void scanLocalWifiForServerAsync() {
        if (isScanningSubnet) return;
        isScanningSubnet = true;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm == null) return;
                    WifiInfo info = wm.getConnectionInfo();
                    if (info == null) return;
                    int ipAddress = info.getIpAddress();
                    if (ipAddress == 0) return;

                    final String prefix = String.format(
                        "%d.%d.%d.",
                        (ipAddress & 0xff),
                        (ipAddress >> 8 & 0xff),
                        (ipAddress >> 16 & 0xff)
                    );

                    ExecutorService pool = Executors.newFixedThreadPool(24);
                    for (int i = 1; i <= 254; i++) {
                        final String candidateIp = prefix + i;
                        pool.execute(new Runnable() {
                            @Override
                            public void run() {
                                if (!discoveredServerUrl.isEmpty()) return;
                                try {
                                    Socket s = new Socket();
                                    s.connect(new InetSocketAddress(candidateIp, 8080), 350);
                                    s.close();

                                    URL checkUrl = new URL("http://" + candidateIp + ":8080/api/state");
                                    HttpURLConnection c = (HttpURLConnection) checkUrl.openConnection();
                                    c.setConnectTimeout(800);
                                    c.setReadTimeout(800);
                                    if (c.getResponseCode() == 200) {
                                        discoveredServerUrl = "http://" + candidateIp + ":8080";
                                        triggerWebViewAutoSync();
                                    }
                                    c.disconnect();
                                } catch (Exception ignored) {}
                            }
                        });
                    }
                    pool.shutdown();
                } catch (Exception ignored) {
                } finally {
                    isScanningSubnet = false;
                }
            }
        }).start();
    }

    private void triggerWebViewAutoSync() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        webView.evaluateJavascript(
                            "if (window.triggerWifiSync) { window.triggerWifiSync(); }",
                            null
                        );
                    } else {
                        webView.loadUrl("javascript:if(window.triggerWifiSync){window.triggerWifiSync();}");
                    }
                }
            }
        });
    }

    private void registerWifiAutoSyncListeners() {
        try {
            connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                NetworkRequest request = new NetworkRequest.Builder()
                    .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                    .build();

                wifiCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        super.onAvailable(network);
                        scanLocalWifiForServerAsync();
                        triggerWebViewAutoSync();
                    }
                };
                connectivityManager.registerNetworkCallback(request, wifiCallback);
            }
        } catch (Exception ignored) {}

        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(WifiManager.NETWORK_STATE_CHANGED_ACTION);
            filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);
            registerReceiver(wifiStateReceiver, filter);
        } catch (Exception ignored) {}
    }

    private void enableImmersiveFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LOW_PROFILE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveFullscreen();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            if (connectivityManager != null && wifiCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                connectivityManager.unregisterNetworkCallback(wifiCallback);
            }
        } catch (Exception ignored) {}
        try {
            unregisterReceiver(wifiStateReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
