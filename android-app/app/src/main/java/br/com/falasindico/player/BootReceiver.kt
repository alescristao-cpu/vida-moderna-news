package br.com.falasindico.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Inicia automaticamente o Player Fala Síndico sempre que o aparelho Android
 * for ligado ou reiniciado após queda de energia no condomínio.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            Intent.ACTION_BOOT_COMPLETED == intent.action ||
            "android.intent.action.QUICKBOOT_POWERON" == intent.action
        ) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launchIntent)
        }
    }
}
