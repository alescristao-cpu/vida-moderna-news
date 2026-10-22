package br.com.falasindico.player

import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Activity Principal do Player Android Fala Síndico (1280x720px | Cartelas 1280x520px).
 * - Sincronização 100% AUTOMÁTICA toda vez que o aparelho captar a rede Wi-Fi:
 *   1. Escuta ConnectivityManager.NetworkCallback (onAvailable & onCapabilitiesChanged)
 *   2. Escuta BroadcastReceiver de mudança de estado do Wi-Fi (NETWORK_STATE_CHANGED_ACTION)
 *   3. Executa verificação automática contínua em background
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var connectivityManager: ConnectivityManager? = null
    private var wifiCallback: ConnectivityManager.NetworkCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val wifiStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            triggerWebViewAutoSync()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Mantém a tela sempre acesa dentro do elevador
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableImmersiveFullscreen()

        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        // Carrega o Player (1280x720)
        webView.loadUrl("file:///android_asset/public/index.html")

        registerWifiAutoSyncListeners()
    }

    private fun triggerWebViewAutoSync() {
        mainHandler.post {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if (window.triggerWifiSync) { window.triggerWifiSync(); }",
                    null
                )
            }
        }
    }

    private fun registerWifiAutoSyncListeners() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        wifiCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                // Dispara imediatamente quando o Wi-Fi conecta
                triggerWebViewAutoSync()
            }

            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                super.onCapabilitiesChanged(network, networkCapabilities)
                if (networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    triggerWebViewAutoSync()
                }
            }
        }

        try {
            connectivityManager?.registerNetworkCallback(request, wifiCallback!!)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        try {
            val filter = IntentFilter().apply {
                addAction(WifiManager.NETWORK_STATE_CHANGED_ACTION)
                addAction(ConnectivityManager.CONNECTIVITY_ACTION)
            }
            registerReceiver(wifiStateReceiver, filter)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun enableImmersiveFullscreen() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveFullscreen()
        }
    }

    override fun onDestroy() {
        try {
            wifiCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (_: Exception) {}
        try {
            unregisterReceiver(wifiStateReceiver)
        } catch (_: Exception) {}
        super.onDestroy()
    }
}
