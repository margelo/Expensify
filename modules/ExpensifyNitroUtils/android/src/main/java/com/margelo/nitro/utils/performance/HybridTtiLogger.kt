package com.margelo.nitro.utils

import android.util.Log
import com.facebook.react.uimanager.ThemedReactContext

internal typealias OnMeasurementsReadyListener = (measurement: TtiMeasurementValue) -> Unit

var lastListenerId = 0.0
class HybridTtiLogger(val context: ThemedReactContext) : HybridTtiLoggerSpec() {

    companion object {
        val measurementListeners = mutableMapOf<Double, OnMeasurementsReadyListener>()
        val invokedListeners = mutableSetOf<Double>()
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

            Log.d("PERFORMANCE_METRICS", "invoke after mark");

            invokeListeners(measurementListeners)
        }

        fun getMeasurements(): TtiMeasurementValue? {
            if (applicationStartupTimestamp == null || firstDrawTimestamp == null) {
                return null
            }


            return TtiMeasurementValue(
                applicationStartup = applicationStartupTimestamp!!,
                firstDraw = firstDrawTimestamp!!,
                bundleExecution = bundleExecutionTimestamp ?: 0.0
            )
        }

        fun invokeListeners(listeners: Map<Double, OnMeasurementsReadyListener>) {
            if (applicationStartupTimestamp == null || firstDrawTimestamp == null) {
                return
            }

            val applicationTimestampString = applicationStartupTimestamp!!.toBigDecimal().toPlainString()
            val firstDrawTimestampString = firstDrawTimestamp!!.toBigDecimal().toPlainString()

            Log.d("PERFORMANCE_METRICS", "invoke $applicationTimestampString $firstDrawTimestampString")

            for ((id, listener) in listeners) {
                if (invokedListeners.contains(id)) continue
                invokedListeners.add(id)

                listener.invoke(TtiMeasurementValue(
                    applicationStartup = applicationStartupTimestamp!!,
                    firstDraw = firstDrawTimestamp!!,
                    bundleExecution = bundleExecutionTimestamp ?: 0.0
                ))
            }
        }

        fun updateListener(listenerId: Double, listener: OnMeasurementsReadyListener) {
            measurementListeners[listenerId] = listener

            // If measurements ready and not yet invoked for this ID, invoke now
            if (!invokedListeners.contains(listenerId)) {
                invokeListeners(mapOf(listenerId to listener))
            }
        }

        fun addMeasurementsReadyListener(listener: OnMeasurementsReadyListener): Double {
            val listenerId = ++lastListenerId
            measurementListeners[listenerId] = listener
            invokeListeners(mapOf(listenerId to listener))
            return listenerId
        }

        fun removeMeasurementsReadyListener(listenerId: Double) {
            measurementListeners.remove(listenerId)
            invokedListeners.remove(listenerId)
        }
    }

    override fun mark(name: TtiMeasurementName, timestamp: Double): Unit {
        HybridTtiLogger.mark(name, timestamp);
    }

    override fun addMeasurementsReadyListener(listener: OnMeasurementsReadyListener): Double {
        return HybridTtiLogger.addMeasurementsReadyListener(listener);
    }

    override fun removeMeasurementsReadyListener(listenerId: Double) {
        HybridTtiLogger.removeMeasurementsReadyListener(listenerId);
    }

    override fun getMeasurements(): TtiMeasurementValue? {
        return HybridTtiLogger.getMeasurements()
    }
}
