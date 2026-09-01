import android.os.SystemClock;
import android.util.Base64;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shell-only input helper. One process injects every released pan in a flow. */
public final class AndroidReleasedPans {
    private final Object inputManager;
    private final Method injectInputEvent;

    private AndroidReleasedPans() throws Exception {
        Class<?> managerClass;
        try {
            managerClass = Class.forName("android.hardware.input.InputManagerGlobal");
        } catch (ClassNotFoundException ignored) {
            managerClass = Class.forName("android.hardware.input.InputManager");
        }
        inputManager = managerClass.getMethod("getInstance").invoke(null);
        injectInputEvent = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
    }

    private void inject(long downTime, int action, float x, float y) throws Exception {
        long eventTime = SystemClock.uptimeMillis();
        MotionEvent event = MotionEvent.obtain(
            downTime, eventTime, action, x, y,
            action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL ? 0f : 1f,
            1f, 0, 1f, 1f, 0, 0
        );
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            // WAIT_FOR_FINISH acknowledges each event. Never start another pan
            // until UP has completed and the explicit release gap has elapsed.
            if (!Boolean.TRUE.equals(injectInputEvent.invoke(inputManager, event, 2))) {
                throw new IllegalStateException("Android rejected touch event " + action);
            }
        } finally {
            event.recycle();
        }
    }

    private static void sleepUntil(long targetTime) {
        long remaining = targetTime - SystemClock.uptimeMillis();
        if (remaining > 0) {
            SystemClock.sleep(remaining);
        }
    }

    private JSONObject pan(float x, float startY, float endY, int durationMs) throws Exception {
        long downTime = SystemClock.uptimeMillis();
        int samples = Math.max(3, (int) Math.ceil(durationMs / 16.0));
        boolean released = false;
        try {
            inject(downTime, MotionEvent.ACTION_DOWN, x, startY);
            for (int index = 1; index < samples; index++) {
                float progress = (float) index / samples;
                sleepUntil(downTime + Math.round(durationMs * progress));
                inject(downTime, MotionEvent.ACTION_MOVE, x, startY + (endY - startY) * progress);
            }
            sleepUntil(downTime + durationMs);
            inject(downTime, MotionEvent.ACTION_UP, x, endY);
            released = true;
        } finally {
            if (!released) {
                inject(downTime, MotionEvent.ACTION_CANCEL, x, startY);
            }
        }
        long upTime = SystemClock.uptimeMillis();
        return new JSONObject()
            .put("downTimeMs", downTime)
            .put("upAcknowledgedTimeMs", upTime)
            .put("requestedDurationMs", durationMs)
            .put("actualDurationMs", upTime - downTime)
            .put("moveEvents", samples - 1);
    }

    public static void main(String[] args) throws Exception {
        AndroidReleasedPans runner = new AndroidReleasedPans();
        if (args.length == 1 && args[0].equals("--probe")) {
            System.out.println("{\"status\":\"READY\"}");
            return;
        }
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected one base64-encoded gesture plan");
        }
        JSONObject plan = new JSONObject(new String(Base64.decode(args[0], Base64.DEFAULT), StandardCharsets.UTF_8));
        float x = (float) plan.getDouble("x");
        float startY = (float) plan.getDouble("startY");
        float endY = (float) plan.getDouble("endY");
        JSONArray batches = plan.getJSONArray("batches");
        JSONArray pans = new JSONArray();
        long started = SystemClock.uptimeMillis();
        for (int batchIndex = 0; batchIndex < batches.length(); batchIndex++) {
            JSONObject batch = batches.getJSONObject(batchIndex);
            int count = batch.getInt("count");
            int durationMs = batch.getInt("durationMs");
            int gapMs = batch.getInt("releaseGapMs");
            if (count < 1 || count > 100 || durationMs < 32 || durationMs > 5000 || gapMs < 1) {
                throw new IllegalArgumentException("Unsafe gesture timing/count");
            }
            for (int panIndex = 0; panIndex < count; panIndex++) {
                pans.put(runner.pan(x, startY, endY, durationMs)
                    .put("batch", batchIndex + 1).put("pan", panIndex + 1));
                if (panIndex + 1 < count) {
                    SystemClock.sleep(gapMs);
                }
            }
            // XCTest does not insert a release gap after the final UP in a batch.
            SystemClock.sleep(batch.getInt("pauseAfterMs"));
        }
        System.out.println(new JSONObject()
            .put("status", "SUCCESS")
            .put("panCount", pans.length())
            .put("durationMs", SystemClock.uptimeMillis() - started)
            .put("pans", pans));
    }
}
