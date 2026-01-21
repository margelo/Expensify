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
    override var onMeasurementsReady: OnMeasurementsReadyListener? = null
        set(value) {
            field = value;
            HybridTtiLogger.setOnMeasurementsReadyListener(value);
        }

    var firstDrawTimestamp: Long? = null

    // View
    override val view: View = View(context)

    init {
        HybridTtiLogger.setOnMeasurementsReadyListener(onMeasurementsReady);
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

            Log.d("PERFORMANCE_METRICS", "firstDrawTimestamp $newFirstDrawTimestamp");

            HybridTtiLogger.mark(TtiMeasurementName.FIRSTDRAW, newFirstDrawTimestamp.toDouble())
        }
    }
}
