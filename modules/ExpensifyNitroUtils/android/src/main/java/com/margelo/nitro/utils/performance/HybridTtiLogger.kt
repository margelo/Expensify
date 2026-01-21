package com.margelo.nitro.utils

import android.util.Log
import com.facebook.react.uimanager.ThemedReactContext

internal typealias OnMeasurementsReadyListener = (measurement: TtiMeasurementValue) -> Unit

class HybridTtiLogger(val context: ThemedReactContext) : HybridTtiLoggerSpec() {

    companion object {
        val measurementListeners = ArrayList<OnMeasurementsReadyListener?>()

        var applicationStartupTimestamp: Double? = null
        var bundleExecutionTimestamp: Double? = null
        var firstDrawTimestamp: Double? = null

        fun mark(name: TtiMeasurementName, timestamp: Double): Unit {
            when (name) {
                TtiMeasurementName.APPLICATIONSTARTUP -> applicationStartupTimestamp = applicationStartupTimestamp ?: timestamp
                TtiMeasurementName.BUNDLEEXECUTION -> bundleExecutionTimestamp = bundleExecutionTimestamp ?: timestamp
                TtiMeasurementName.FIRSTDRAW -> firstDrawTimestamp =firstDrawTimestamp ?: timestamp
            }

            if (applicationStartupTimestamp == null || firstDrawTimestamp == null) {
                return
            }

            val applicationTimestampString = applicationStartupTimestamp!!.toBigDecimal().toPlainString()
            val firstDrawTimestampString = firstDrawTimestamp!!.toBigDecimal().toPlainString()

            Log.d("PERFORMANCE_METRICS", "invoke $applicationTimestampString $firstDrawTimestampString");

            for (listener in measurementListeners) {
                listener?.invoke(TtiMeasurementValue(
                    applicationStartup = applicationStartupTimestamp!!,
                    firstDraw= firstDrawTimestamp!!,
                    bundleExecution = bundleExecutionTimestamp ?: 0.0
                ))
                measurementListeners.remove(listener)
            }
        }

        fun setOnMeasurementsReadyListener(listener: ((measurement: TtiMeasurementValue) -> Unit)?) {
            if (listener == null) {
                return
            }

            if (applicationStartupTimestamp == null || firstDrawTimestamp == null) {
                measurementListeners.add(listener)
                return
            }

            val applicationTimestampString = applicationStartupTimestamp!!.toBigDecimal().toPlainString()
            val firstDrawTimestampString = firstDrawTimestamp!!.toBigDecimal().toPlainString()

            Log.d("PERFORMANCE_METRICS", "invoke direct $applicationTimestampString $firstDrawTimestampString");

            listener.invoke(TtiMeasurementValue(
                applicationStartup = applicationStartupTimestamp!!,
                firstDraw= firstDrawTimestamp!!,
                bundleExecution = bundleExecutionTimestamp ?: 0.0
            ))
        }
    }

    override fun mark(name: TtiMeasurementName, timestamp: Double): Unit {
        HybridTtiLogger.mark(name, timestamp);
    }

    override fun setOnMeasurementsReadyListener(listener: ((measurement: TtiMeasurementValue) -> Unit)?) {
        HybridTtiLogger.setOnMeasurementsReadyListener(listener);
    }
}
