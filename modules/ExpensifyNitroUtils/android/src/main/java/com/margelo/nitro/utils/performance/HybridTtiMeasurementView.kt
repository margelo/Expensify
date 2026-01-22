package com.margelo.nitro.utils

import android.os.Build
import android.util.Log
import android.view.View
import androidx.annotation.RequiresApi
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.utils.performance.FirstDrawDoneListener
import java.util.concurrent.TimeUnit

class HybridTtiMeasurementView(val context: ThemedReactContext) : HybridTtiMeasurementViewSpec() {
    // Props
    var listenerId: Double? = null

    override var onMeasurementsReady: OnMeasurementsReadyListener? = null

    override fun afterUpdate() {
        val listener = onMeasurementsReady ?: return

        val existingId = listenerId
        if (existingId != null) {
            // Update callback reference, keep same ID
            HybridTtiLogger.updateListener(existingId, listener)
        } else {
            // First time - register new listener
            listenerId = HybridTtiLogger.addMeasurementsReadyListener(listener)
        }
    }

    var firstDrawTimestamp: Long? = null

    // View
    override val view: View = View(context)

    init {
        registerDrawListener()
    }

    @RequiresApi(Build.VERSION_CODES.JELLY_BEAN)
    private fun registerDrawListener() {
        FirstDrawDoneListener.registerForNextDraw(view) {
            if (firstDrawTimestamp != null) {
                return@registerForNextDraw
            }

            System.nanoTime()
            val newFirstDrawTimestamp = TimeUnit.NANOSECONDS.toMillis(System.nanoTime())
            firstDrawTimestamp = newFirstDrawTimestamp

            HybridTtiLogger.mark(TtiMeasurementName.FIRSTDRAW, newFirstDrawTimestamp.toDouble())
        }
    }
}
